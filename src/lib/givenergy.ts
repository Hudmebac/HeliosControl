
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
  RawCommunicationDevice,
} from "@/lib/types";

const GIVENERGY_API_BASE_URL = "https://api.givenergy.cloud/v1";

async function _fetchGivEnergyAPI<T>(apiKey: string, endpoint: string, options?: RequestInit): Promise<T> {
  const headers = new Headers({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  });

  try {
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
      throw new Error(`GivEnergy API Error: ${response.status} ${response.statusText} - ${errorBody?.message || 'API request failed with no specific message.'}`);
    }
    return response.json() as Promise<T>;
  } catch (networkError: any) {
    console.error("Network error in _fetchGivEnergyAPI:", networkError);
    // Handle generic "Failed to fetch" and other network-level errors
    if (networkError.message.toLowerCase().includes('failed to fetch')) {
        throw new Error(`Network error: Could not connect to GivEnergy API. Please check your internet connection, VPN/proxy settings, and ensure the API is accessible. (Details: ${networkError.message})`);
    }
    // Re-throw other types of errors
    throw new Error(`An unexpected error occurred during the API request: ${networkError.message}`);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
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

  let primaryDevice: RawCommunicationDevice | undefined;

  try {
    const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    if (commDevicesResponse.data && commDevicesResponse.data.length > 0) {
        // Attempt to find a device with an inverter serial and UUID
        primaryDevice = commDevicesResponse.data.find(device => device.inverter?.serial && device.uuid);

        if (primaryDevice && primaryDevice.inverter?.serial && primaryDevice.uuid) {
            inverterSerial = primaryDevice.inverter.serial;
            inverterCommDeviceUUID = primaryDevice.uuid;
        }
    }
    
    if (!inverterSerial || !inverterCommDeviceUUID) {
      throw new Error("No active communication devices with complete inverter details (serial and UUID) found for this API key. Please check your GivEnergy account setup or ensure the primary device is properly registered and online.");
    }

  } catch (error) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs:", error);
    const baseMessage = "Failed to retrieve essential device identifiers from GivEnergy";
    if (error instanceof Error && error.message.startsWith("Network error:")) { // Propagate network errors
        throw error;
    }
    if (error instanceof Error) {
        throw new Error(`${baseMessage}: ${error.message}`);
    }
    throw new Error(`${baseMessage}: An unknown error occurred.`);
  }

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
    return "idle";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  if (!apiKey) {
    throw new Error("API Key not provided");
  }

  const { inverterSerial, evChargerId } = await _getPrimaryDeviceIDs(apiKey);

  const systemDataResponse = await _fetchGivEnergyAPI<RawSystemDataLatestResponse>(apiKey, `/inverter/${inverterSerial}/system-data/latest`);
  const rawData = systemDataResponse.data;

  const homeConsumption: Metric = {
    value: parseFloat((rawData.consumption.power / 1000).toFixed(2)), 
    unit: "kW",
  };

  const solarGeneration: Metric = {
    value: parseFloat((rawData.solar.power / 1000).toFixed(2)), 
    unit: "kW",
  };

  const batteryPowerWatts = rawData.battery.power;
  const batteryPercentage = rawData.battery.percent;
  const battery: BatteryStatus = {
    value: batteryPercentage,
    unit: "%",
    percentage: batteryPercentage,
    charging: batteryPowerWatts < 0 ? true : (batteryPowerWatts > 0 ? false : undefined),
  };

  const gridPowerWatts = rawData.grid.power;
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat((Math.abs(gridPowerWatts) / 1000).toFixed(2)), 
    unit: "kW",
    flow: gridPowerWatts > 50 ? 'importing' : (gridPowerWatts < -50 ? 'exporting' : 'idle'), 
  };

  let evCharger: EVChargerStatus = {
    value: 0,
    unit: "kW",
    status: "disconnected", 
  };

  if (evChargerId) {
    try {
      const evStatusResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(apiKey, `/ev-charger/${evChargerId}/status`);
      const rawEVData = evStatusResponse.data;
      evCharger = {
        value: rawEVData.charge_session?.power ? parseFloat((rawEVData.charge_session.power / 1000).toFixed(1)) : 0, 
        unit: "kW",
        status: mapEVChargerAPIStatus(rawEVData.status),
      };
    } catch (error) {
        console.warn(`Failed to fetch EV charger (${evChargerId}) status:`, error);
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
