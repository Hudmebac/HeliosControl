
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
    console.error(`GivEnergy API request failed for endpoint '${endpoint}'. Original error:`, error);

    let originalMessage = "Unknown error during fetch operation";
    if (error instanceof Error) {
      originalMessage = error.message;
    } else if (typeof error === 'string') {
      originalMessage = error;
    }

    if (error instanceof TypeError &&
        (originalMessage.toLowerCase().includes('failed to fetch') ||
         originalMessage.toLowerCase().includes('networkerror') ||
         originalMessage.toLowerCase().includes('load failed'))) {
      const detailedMessage = `Network error: Could not connect to GivEnergy API (${GIVENERGY_API_BASE_URL}). Please check your internet connection, VPN/proxy settings, or if the API is temporarily unavailable. (Original error: ${originalMessage})`;
      console.error("Throwing detailed network error from _fetchGivEnergyAPI:", detailedMessage);
      throw new Error(detailedMessage);
    }

    const errorMessage = `GivEnergy API Request Failed: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI:", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Attempt to fetch a list of communication devices as a validation step
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    return true;
  } catch (error) {
    console.error("API Key validation failed:", error);
    // If the error is a specific GivEnergy API error (e.g. 401 Unauthorized), it's a validation failure
    if (error instanceof Error && error.message.startsWith("GivEnergy API Error: 401")) {
        return false;
    }
    // For other errors (network, etc.), we might not be able to definitively say the key is invalid,
    // but for practical purposes of this function, it fails validation.
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let inverterCommDeviceUUID: string | null = null;
  let evChargerId: string | null = null;

  try {
    const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    if (commDevicesResponse.data && commDevicesResponse.data.length > 0) {
        // Prefer a device that is explicitly an inverter and online, if such info were available directly.
        // For now, take the first one with a serial number and UUID.
        const primaryDevice = commDevicesResponse.data.find(device => device.inverter?.serial && device.uuid);

        if (primaryDevice && primaryDevice.inverter?.serial && primaryDevice.uuid) {
            inverterSerial = primaryDevice.inverter.serial;
            inverterCommDeviceUUID = primaryDevice.uuid;
        }
    }

    if (!inverterSerial || !inverterCommDeviceUUID) {
      throw new Error("Failed to identify a primary inverter from your GivEnergy account using the provided API key. Please ensure: 1. Your API key is correct and has permissions to access device information. 2. You have at least one inverter registered and online in your GivEnergy portal (givenergy.cloud). 3. The inverter's communication dongle is connected and online.");
    }

  } catch (error: any) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs:", error);
    // Re-throw if it's already a well-formatted network or API error
    if (error.message && (error.message.toLowerCase().includes('network error:') || error.message.toLowerCase().includes('givenergy api error:'))) {
        throw error;
    }
    // Otherwise, wrap it
    throw new Error(`Failed to retrieve essential device identifiers from GivEnergy: ${error.message || 'An unknown error occurred.'}`);
  }

  // Fetch EV Charger ID if an inverter was found
  if (inverterSerial) {
    try {
      const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, "/ev-charger");
      if (evChargersResponse.data && evChargersResponse.data.length > 0 && evChargersResponse.data[0].id) {
          evChargerId = evChargersResponse.data[0].id;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key. EV Charger metrics will not be available.");
      }
    } catch (error: any) {
        console.warn(`Could not fetch EV chargers list (this is optional and may not affect core functionality): ${error.message}. EV Charger metrics will not be available.`);
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
    const lowerApiStatus = apiStatus.toLowerCase().replace(/_/g, ' '); // Normalize underscores and case

    if (lowerApiStatus.includes("fault") || lowerApiStatus.includes("error")) return "faulted";
    // Check for "charging" but not "charging schedule" or "scheduled charging"
    if (lowerApiStatus.includes("charging") && !lowerApiStatus.includes("schedule")) return "charging";
    if (lowerApiStatus === "disconnected" || lowerApiStatus.includes("not connected") || lowerApiStatus.includes("unavailable")) return "disconnected";
    
    // Any other state (e.g., "idle", "paused", "standby", "scheduled", "vehicle connected", "eco mode") 
    // where it's connected but not actively charging, faulted, or explicitly disconnected is considered 'idle'.
    return "idle";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  const { inverterSerial, evChargerId } = await _getPrimaryDeviceIDs(apiKey);
  // inverterSerial is guaranteed by _getPrimaryDeviceIDs or it would have thrown

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
    // Negative power means charging, positive means discharging
    charging: batteryPowerWatts < 0 ? true : (batteryPowerWatts > 0 ? false : undefined), // undefined if exactly 0
  };

  const gridPowerWatts = rawData.grid.power;
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat((Math.abs(gridPowerWatts) / 1000).toFixed(2)), // Watts to kW
    unit: "kW",
    // Positive power means importing, negative means exporting. Threshold to avoid flickering.
    flow: gridPowerWatts > 50 ? 'importing' : (gridPowerWatts < -50 ? 'exporting' : 'idle'),
  };

  let evCharger: EVChargerStatus = {
    value: 0,
    unit: "kW",
    status: "disconnected", // Default if no EV charger or data fetch fails
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
    } catch (error: any) {
        console.warn(`Failed to fetch EV charger (${evChargerId}) status (this is optional): ${error.message}. Defaulting to disconnected status.`);
         evCharger.status = "disconnected"; // Ensure status is disconnected on error
    }
  }

  return {
    homeConsumption,
    solarGeneration,
    battery,
    grid,
    evCharger,
    timestamp: new Date(rawData.time).getTime() || Date.now(), // Fallback to current time if API time is invalid
  };
}
