
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

// IMPORTANT: All calls will now go through our internal Next.js API proxy
const PROXY_API_BASE_URL = "/api/proxy-givenergy"; 

async function _fetchGivEnergyAPI<T>(apiKey: string, endpoint: string, options?: RequestInit): Promise<T> {
  const headers = new Headers({
    "Authorization": `Bearer ${apiKey}`, // This header will be read by our proxy
    "Content-Type": "application/json",
    "Accept": "application/json",
  });

  // Ensure endpoint doesn't have a leading slash if PROXY_API_BASE_URL doesn't expect it,
  // or ensure it does if it's needed for concatenation.
  // Current proxy structure /api/proxy-givenergy/[...slug] expects paths like 'communication-devices'
  const fetchUrl = `${PROXY_API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const response = await fetch(fetchUrl, {
      ...options,
      method: options?.method || 'GET', // Default to GET
      headers,
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        // Ignore if body isn't json
      }
      // Error message might come from the proxy or the GivEnergy API via the proxy
      throw new Error(errorBody?.error || errorBody?.message || `API Request Error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  } catch (error: unknown) {
    console.error(`Proxied GivEnergy API request failed for endpoint '${endpoint}'. Original error:`, error);

    let originalMessage = "Unknown error during fetch operation";
    if (error instanceof Error) {
      originalMessage = error.message;
    } else if (typeof error === 'string') {
      originalMessage = error;
    }
    
    // Check if it's a network error from the client to the proxy.
    if (error instanceof TypeError &&
        (originalMessage.toLowerCase().includes('failed to fetch') ||
         originalMessage.toLowerCase().includes('networkerror') ||
         originalMessage.toLowerCase().includes('load failed'))) {
      const detailedMessage = `Network error: Could not connect to the application's API proxy (${PROXY_API_BASE_URL}). Please check your internet connection and ensure the application server is running. (Original error: ${originalMessage})`;
      console.error("Throwing detailed network error from _fetchGivEnergyAPI (proxy call):", detailedMessage);
      throw new Error(detailedMessage);
    }
    
    // For other errors (e.g., errors returned by the proxy itself, or unexpected issues)
    const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    return true;
  } catch (error) {
    console.error("API Key validation failed via proxy:", error);
    if (error instanceof Error && error.message.includes("401")) { // Assuming proxy forwards 401 for bad keys
        return false;
    }
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let inverterCommDeviceUUID: string | null = null;
  let evChargerId: string | null = null;

  try {
    // Endpoint path should be relative to /v1/ of the GivEnergy API
    const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    if (commDevicesResponse.data && commDevicesResponse.data.length > 0) {
        const primaryDevice = commDevicesResponse.data.find(device => device.inverter?.serial && device.uuid);
        if (primaryDevice && primaryDevice.inverter?.serial && primaryDevice.uuid) {
            inverterSerial = primaryDevice.inverter.serial;
            inverterCommDeviceUUID = primaryDevice.uuid;
        }
    }

    if (!inverterSerial || !inverterCommDeviceUUID) {
      throw new Error("Failed to identify a primary inverter from your GivEnergy account via proxy. Please ensure: 1. Your API key is correct and has permissions. 2. You have at least one inverter registered and online. 3. The inverter's communication dongle is connected and online.");
    }

  } catch (error: any) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs (via proxy):", error);
    if (error.message && (error.message.toLowerCase().includes('network error:') || error.message.toLowerCase().includes('api request error:'))) {
        throw error;
    }
    throw new Error(`Failed to retrieve essential device identifiers from GivEnergy (via proxy): ${error.message || 'An unknown error occurred.'}`);
  }

  if (inverterSerial) {
    try {
      const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, "/ev-charger");
      if (evChargersResponse.data && evChargersResponse.data.length > 0 && evChargersResponse.data[0].id) {
          evChargerId = evChargersResponse.data[0].id;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key (via proxy).");
      }
    } catch (error: any) {
        console.warn(`Could not fetch EV chargers list (via proxy, optional): ${error.message}.`);
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
    const lowerApiStatus = apiStatus.toLowerCase().replace(/_/g, ' ').trim();

    if (lowerApiStatus.includes("fault") || lowerApiStatus.includes("error")) return "faulted";
    if (lowerApiStatus === "charging") return "charging"; // Exact match for "CHARGING"
    if (lowerApiStatus === "disconnected" || lowerApiStatus.includes("not connected") || lowerApiStatus.includes("unavailable")) return "disconnected";
    
    // Consider "idle", "paused", "standby", "scheduled", "charging scheduled", "vehicle connected", "eco mode" as idle
    // If it's connected but not actively charging or faulted, it's idle.
    return "idle";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
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
    } catch (error: any) {
        console.warn(`Failed to fetch EV charger (${evChargerId}) status (via proxy, optional): ${error.message}. Defaulting to disconnected status.`);
         evCharger.status = "disconnected";
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
