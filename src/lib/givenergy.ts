
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
  } catch (error: unknown) {
    console.error("GivEnergy API request failed in _fetchGivEnergyAPI. Original error:", error);

    let originalMessage = "Unknown error during fetch operation";
    if (error instanceof Error) {
      originalMessage = error.message;
    } else if (typeof error === 'string') {
      originalMessage = error;
    }

    // Check for typical network error indicators. Browsers often throw TypeError for these.
    if (error instanceof TypeError && 
        (originalMessage.toLowerCase().includes('failed to fetch') || 
         originalMessage.toLowerCase().includes('networkerror'))) { // Common substrings for network issues
      const detailedMessage = `Network error: Could not connect to GivEnergy API (${GIVENERGY_API_BASE_URL}). Please check your internet connection, VPN/proxy settings, or if the API is temporarily unavailable. (Original error: ${originalMessage})`;
      console.error("Throwing detailed network error from _fetchGivEnergyAPI:", detailedMessage);
      throw new Error(detailedMessage);
    }
    
    // Fallback for other errors that might occur during the fetch process or if it's an error object with a message
    const errorMessage = `GivEnergy API Request Failed: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Make a lightweight call to check if API key is accepted
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
        primaryDevice = commDevicesResponse.data.find(device => device.inverter?.serial && device.uuid);

        if (primaryDevice && primaryDevice.inverter?.serial && primaryDevice.uuid) {
            inverterSerial = primaryDevice.inverter.serial;
            inverterCommDeviceUUID = primaryDevice.uuid;
        }
    }
    
    if (!inverterSerial || !inverterCommDeviceUUID) {
      // This error will be caught by the calling function and displayed if necessary
      throw new Error("No active communication devices with complete inverter details (serial and UUID) found for this API key. Please check your GivEnergy account setup, ensure the primary device is properly registered and online, or verify the API key has the correct permissions.");
    }

  } catch (error: any) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs:", error);
    const baseMessage = "Failed to retrieve essential device identifiers from GivEnergy";
    if (error.message.toLowerCase().includes('network error:')) { 
        throw error; // Re-throw the detailed network error from _fetchGivEnergyAPI
    }
    throw new Error(`${baseMessage}: ${error.message || 'An unknown error occurred.'}`);
  }

  // EV Charger ID is optional, so we don't fail hard if not found
  if (inverterSerial) {
    try {
      const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, "/ev-charger");
      if (evChargersResponse.data && evChargersResponse.data.length > 0 && evChargersResponse.data[0].id) {
          evChargerId = evChargersResponse.data[0].id;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key.");
      }
    } catch (error) {
        console.warn("Could not fetch EV chargers list (this is optional and may not affect core functionality):", error);
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
    if (lowerApiStatus.includes("disconnected") || lowerApiStatus.includes("idle") || lowerApiStatus.includes("paused") || lowerApiStatus.includes("scheduled")) return "idle"; // Grouping these as idle for simplicity
    if (lowerApiStatus.includes("fault") || lowerApiStatus.includes("error")) return "faulted";
    return "idle"; // Default to idle
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  if (!apiKey) {
    throw new Error("API Key not provided. Cannot fetch real-time data.");
  }

  const { inverterSerial, evChargerId } = await _getPrimaryDeviceIDs(apiKey);
  // _getPrimaryDeviceIDs will throw if inverterSerial is not found, so no need to check here.

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
    charging: batteryPowerWatts < 0 ? true : (batteryPowerWatts > 0 ? false : undefined), // Assuming negative power is charging, positive is discharging
  };

  const gridPowerWatts = rawData.grid.power;
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat((Math.abs(gridPowerWatts) / 1000).toFixed(2)), 
    unit: "kW",
    flow: gridPowerWatts > 50 ? 'importing' : (gridPowerWatts < -50 ? 'exporting' : 'idle'), // Small deadband for idle
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
    } catch (error: any) {
        console.warn(`Failed to fetch EV charger (${evChargerId}) status (this is optional): ${error.message}`);
        // Do not overwrite the default "disconnected" status if fetching fails
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
