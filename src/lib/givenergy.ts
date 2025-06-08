
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
  RawEVCharger,
  GivEnergyPaginatedResponse,
} from "@/lib/types";

const PROXY_API_BASE_URL = "/api/proxy-givenergy";
// This needs to match the base URL that the GivEnergy API uses in its `links` for pagination.
const GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING = 'https://api.givenergy.cloud/v1';


async function _fetchGivEnergyAPI<T>(apiKey: string, endpoint: string, options?: RequestInit): Promise<T> {
  const headers = new Headers({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  });

  const fetchUrl = `${PROXY_API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const response = await fetch(fetchUrl, {
      ...options,
      method: options?.method || 'GET',
      headers,
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        // Ignore if body isn't json
      }
      const errorMessage = errorBody?.error || errorBody?.message || `API Request Error: ${response.status} ${response.statusText}`;
      console.error(`GivEnergy API error for ${fetchUrl}: ${response.status}`, errorBody);
      throw new Error(errorMessage);
    }
    return response.json() as Promise<T>;
  } catch (error: unknown) {
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
      const detailedMessage = `Network error: Could not connect to the application's API proxy (${PROXY_API_BASE_URL}). Please check your internet connection and ensure the application server is running. (Original error: ${originalMessage})`;
      console.error("Throwing detailed network error from _fetchGivEnergyAPI (proxy call):", detailedMessage);
      throw new Error(detailedMessage);
    }
    
    const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Fetches the first page of communication devices. A successful response (even if empty) indicates a valid key.
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-devices");
    return true;
  } catch (error) {
    console.error("API Key validation failed via proxy:", error);
    // Proxy should ideally forward 401 status for bad keys
    if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthenticated"))) {
        return false;
    }
    // For other errors (network, server errors from GivEnergy), also consider validation failed.
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let inverterCommDeviceUUID: string | null = null;
  let evChargerId: string | null = null;

  const allCommDevices: RawCommunicationDevice[] = [];
  let commDevicesNextPageEndpoint: string | null = "/communication-devices";

  try {
    while (commDevicesNextPageEndpoint) {
      const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, commDevicesNextPageEndpoint);
      allCommDevices.push(...commDevicesResponse.data);

      if (commDevicesResponse.links.next) {
        const nextFullUrl = commDevicesResponse.links.next;
        if (nextFullUrl.startsWith(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING)) {
          commDevicesNextPageEndpoint = nextFullUrl.substring(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING.length);
          if (!commDevicesNextPageEndpoint.startsWith('/')) { // Ensure leading slash if not present
             commDevicesNextPageEndpoint = '/' + commDevicesNextPageEndpoint;
          }
        } else {
          console.warn("Next communication devices page URL from unexpected base:", nextFullUrl);
          commDevicesNextPageEndpoint = null;
        }
      } else {
        commDevicesNextPageEndpoint = null;
      }
    }

    if (allCommDevices.length > 0) {
        const primaryDevice = allCommDevices.find(device => device.inverter?.serial && device.uuid);
        if (primaryDevice && primaryDevice.inverter?.serial && primaryDevice.uuid) {
            inverterSerial = primaryDevice.inverter.serial;
            inverterCommDeviceUUID = primaryDevice.uuid;
        }
    }

    if (!inverterSerial || !inverterCommDeviceUUID) {
      throw new Error("Failed to identify a primary inverter from your GivEnergy account via proxy after checking all devices. Please ensure: 1. Your API key is correct and has permissions. 2. You have at least one inverter registered and online. 3. The inverter's communication dongle is connected and online.");
    }

  } catch (error: any) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs (via proxy):", error);
    if (error.message && (error.message.toLowerCase().includes('network error:') || error.message.toLowerCase().includes('api request error:'))) {
        throw error; // Re-throw specific network or API errors
    }
    throw new Error(`Failed to retrieve essential device identifiers from GivEnergy (communication devices pagination via proxy): ${error.message || 'An unknown error occurred.'}`);
  }

  if (inverterSerial) { // Only try to find EV chargers if we found an inverter
    const allEVChargers: RawEVCharger[] = [];
    let evChargersNextPageEndpoint: string | null = "/ev-charger";
    try {
      while (evChargersNextPageEndpoint) {
        const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, evChargersNextPageEndpoint);
        allEVChargers.push(...evChargersResponse.data);
        
        if (evChargersResponse.links.next) {
          const nextFullUrl = evChargersResponse.links.next;
          if (nextFullUrl.startsWith(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING)) {
            evChargersNextPageEndpoint = nextFullUrl.substring(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING.length);
             if (!evChargersNextPageEndpoint.startsWith('/')) { // Ensure leading slash
               evChargersNextPageEndpoint = '/' + evChargersNextPageEndpoint;
            }
          } else {
            console.warn("Next EV chargers page URL from unexpected base:", nextFullUrl);
            evChargersNextPageEndpoint = null;
          }
        } else {
          evChargersNextPageEndpoint = null;
        }
      }

      if (allEVChargers.length > 0 && allEVChargers[0].id) { // Taking the first EV charger found
          evChargerId = allEVChargers[0].id;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key after checking all pages (via proxy).");
      }
    } catch (error: any) {
        console.warn(`Could not fetch EV chargers list (pagination via proxy, optional): ${error.message}.`);
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
    if (lowerApiStatus === "charging") return "charging";
    if (lowerApiStatus === "disconnected" || lowerApiStatus.includes("not connected") || lowerApiStatus.includes("unavailable") || lowerApiStatus.includes("vehicle not detected")) return "disconnected";
    
    // Consider "idle", "paused", "standby", "scheduled", "charging scheduled", "vehicle connected", "eco mode" as idle
    // If it's connected but not actively charging or faulted, it's idle.
    return "idle";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  const { inverterSerial, evChargerId } = await getDeviceIDs(apiKey); // Changed to call updated getDeviceIDs

  if (!inverterSerial) {
    throw new Error("Could not determine inverter serial. Cannot fetch real-time data.");
  }

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
    charging: batteryPowerWatts < 0 ? true : (batteryPowerWatts > 0 ? false : undefined), // Negative power means charging (power flowing into battery)
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
        console.warn(`Failed to fetch EV charger (${evChargerId}) status (via proxy, optional): ${error.message}. Defaulting to disconnected status.`);
         evCharger.status = "disconnected"; // Ensure status is explicitly set on error
    }
  }

  return {
    homeConsumption,
    solarGeneration,
    battery,
    grid,
    evCharger,
    timestamp: new Date(rawData.time).getTime() || Date.now(), // Fallback to Date.now() if rawData.time is invalid
  };
}
