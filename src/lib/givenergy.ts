
import type {
  RealTimeData,
  GivEnergyIDs,
  Metric,
  BatteryStatus,
  EVChargerStatus,
  RawCommunicationDevicesResponse,
  RawSystemDataLatestResponse,
  RawEVChargersResponse,
  RawEVChargerStatusResponse,
} from "@/lib/types";

const GIVENERGY_API_BASE_URL = "https://api.givenergy.cloud/v1";

async function _fetchGivEnergyAPI<T>(apiKey: string, endpoint: string, options?: RequestInit): Promise<T> {
  const headers = new Headers({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  });

  const response = await fetch(`${GIVENERGY_API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch (e) {
      // Ignore if body isn't json
    }
    throw new Error(`GivEnergy API Error: ${response.status} ${response.statusText} - ${errorBody?.message || 'Unknown error'}`);
  }
  return response.json() as Promise<T>;
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Try fetching communication devices as a way to validate the key
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    return true;
  } catch (error) {
    console.error("API Key validation failed:", error);
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let inverterCommDeviceUUID: string | null = null;
  let evChargerId: string | null = null;

  try {
    const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    if (commDevicesResponse.data &&
        commDevicesResponse.data.length > 0 &&
        commDevicesResponse.data[0].inverter &&
        commDevicesResponse.data[0].inverter.serial &&
        commDevicesResponse.data[0].uuid) {
      inverterSerial = commDevicesResponse.data[0].inverter.serial;
      inverterCommDeviceUUID = commDevicesResponse.data[0].uuid;
    } else {
      throw new Error("No active communication devices found for this API key, or the primary device is missing required information (inverter serial/UUID). Please check your GivEnergy account setup.");
    }
  } catch (error) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs:", error);
    const baseMessage = "Failed to retrieve essential device identifiers from GivEnergy";
    if (error instanceof Error) {
        throw new Error(`${baseMessage}: ${error.message}`);
    }
    throw new Error(`${baseMessage}: An unknown error occurred.`);
  }

  // EV Charger fetching (optional, so failures are logged but don't stop the process if inverter ID was found)
  // This ensures inverterSerial is not null due to the throw logic above.
  // However, TypeScript still sees inverterSerial as string | null from its initial declaration.
  // The control flow guarantees it's a string if this point is reached without an error.
  if (inverterSerial) { 
    try {
      const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, "/ev-charger");
      if (evChargersResponse.data && evChargersResponse.data.length > 0 && evChargersResponse.data[0].id) {
          evChargerId = evChargersResponse.data[0].id;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key.");
      }
    } catch (error) {
        console.warn("Could not fetch EV chargers list (this is optional):", error);
    }
  }
  
  // If we reach here, inverterSerial and inverterCommDeviceUUID must be non-null due to the throw logic.
  return { inverterSerial: inverterSerial!, inverterCommDeviceUUID: inverterCommDeviceUUID!, evChargerId };
}

export async function getDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
    if (!apiKey) {
        throw new Error("API Key not provided for getDeviceIDs");
    }
    return _getPrimaryDeviceIDs(apiKey);
}


function mapEVChargerAPIStatus(apiStatus: string): EVChargerStatus['status'] {
    const lowerApiStatus = apiStatus.toLowerCase();
    if (lowerApiStatus.includes("charging")) return "charging";
    if (lowerApiStatus.includes("disconnected")) return "disconnected";
    if (lowerApiStatus.includes("fault") || lowerApiStatus.includes("error")) return "faulted";
    // Default to idle for "idle", "paused", "smart", "boost" etc.
    return "idle";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  if (!apiKey) {
    throw new Error("API Key not provided");
  }

  // _getPrimaryDeviceIDs will throw if inverterSerial cannot be obtained.
  // The inverterSerial from its return type will be a string if successful.
  const { inverterSerial, evChargerId } = await _getPrimaryDeviceIDs(apiKey);

  const systemDataResponse = await _fetchGivEnergyAPI<RawSystemDataLatestResponse>(apiKey, `/inverter/${inverterSerial}/system-data/latest`);
  const rawData = systemDataResponse.data;

  const homeConsumption: Metric = {
    value: parseFloat((rawData.consumption.power / 1000).toFixed(2)), // Watts to kW
    unit: "kW",
  };

  const solarGeneration: Metric = {
    value: parseFloat((rawData.solar.power / 1000).toFixed(2)), // Watts to kW
    unit: "kW",
  };

  const batteryPowerWatts = rawData.battery.power;
  const batteryPercentage = rawData.battery.percent;
  const battery: BatteryStatus = {
    value: batteryPercentage,
    unit: "%",
    percentage: batteryPercentage,
    // API: battery.power positive for discharge, negative for charge
    charging: batteryPowerWatts < 0 ? true : (batteryPowerWatts > 0 ? false : undefined),
  };

  const gridPowerWatts = rawData.grid.power;
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat((Math.abs(gridPowerWatts) / 1000).toFixed(2)), // Watts to kW
    unit: "kW",
    // API: grid.power positive for import, negative for export
    flow: gridPowerWatts > 50 ? 'importing' : (gridPowerWatts < -50 ? 'exporting' : 'idle'), // Added a small deadband
  };

  let evCharger: EVChargerStatus = {
    value: 0,
    unit: "kW",
    status: "disconnected", // Default status
  };

  if (evChargerId) {
    try {
      const evStatusResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(apiKey, `/ev-charger/${evChargerId}/status`);
      const rawEVData = evStatusResponse.data;
      evCharger = {
        value: rawEVData.charge_session?.power ? parseFloat((rawEVData.charge_session.power / 1000).toFixed(1)) : 0, // Watts to kW
        unit: "kW",
        status: mapEVChargerAPIStatus(rawEVData.status),
      };
    } catch (error) {
        console.warn(`Failed to fetch EV charger (${evChargerId}) status:`, error);
        // Keep default/disconnected status if EV charger data fails
    }
  }


  return {
    homeConsumption,
    solarGeneration,
    battery,
    grid,
    evCharger,
    timestamp: new Date(rawData.time).getTime() || Date.now(),
  };
}

