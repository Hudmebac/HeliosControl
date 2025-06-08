
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
  let evChargerId: string | null = null;

  try {
    const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    if (commDevicesResponse.data && commDevicesResponse.data.length > 0) {
      inverterSerial = commDevicesResponse.data[0].inverter.serial;
    }
  } catch (error) {
    console.warn("Could not fetch communication devices (inverter serial):", error);
    // Potentially throw error if inverter serial is critical and not found
  }

  try {
    const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, "/ev-charger");
    if (evChargersResponse.data && evChargersResponse.data.length > 0) {
        evChargerId = evChargersResponse.data[0].id;
    }
  } catch (error) {
      console.warn("Could not fetch EV chargers list:", error);
      // It's okay if no EV charger is found, it's optional.
  }
  
  return { inverterSerial, evChargerId };
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

  const { inverterSerial, evChargerId } = await _getPrimaryDeviceIDs(apiKey);

  if (!inverterSerial) {
    throw new Error("Could not retrieve inverter serial number. Cannot fetch real-time data.");
  }

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
