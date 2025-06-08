
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
  EVChargerInternalStatus,
  RawSystemDataLatest,
  RawEVChargerStatus as RawEVChargerStatusType,
  GivEnergyAPIData,
} from "@/lib/types";

const PROXY_API_BASE_URL = "/api/proxy-givenergy";
const GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING = 'https://api.givenergy.cloud/v1';


async function _fetchGivEnergyAPI<T>(apiKey: string, endpoint: string, options?: RequestInit): Promise<T> {
  const headers = new Headers({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  });

  const correctedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fetchUrl = `${PROXY_API_BASE_URL}${correctedEndpoint}`;

  try {
    const response = await fetch(fetchUrl, {
      ...options,
      method: options?.method || 'GET',
      headers,
    });

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch (e) {
        // Non-JSON error response or empty body
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
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as {message: any}).message === 'string') {
      originalMessage = (error as {message: string}).message;
    }
    
    if (error instanceof TypeError && 
        (originalMessage.toLowerCase().includes('failed to fetch') ||
         originalMessage.toLowerCase().includes('networkerror') ||
         originalMessage.toLowerCase().includes('load failed'))) {
      const detailedMessage = `Network error: Could not connect to the application's API proxy (${PROXY_API_BASE_URL}). Please check your internet connection and ensure the application server is running. (Original error: ${originalMessage})`;
      console.error("Throwing detailed network error from _fetchGivEnergyAPI (proxy call):", detailedMessage);
      throw new Error(detailedMessage);
    }
    
    if (originalMessage.startsWith("API Request Error:") || originalMessage.startsWith("GivEnergy API error for") || originalMessage.startsWith("Network error:")) {
        throw error; 
    }

    const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Use singular endpoint as per recent findings
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-device");
    return true;
  } catch (error) {
    console.error("API Key validation failed via proxy:", error);
    if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthenticated"))) {
        return false;
    }
    if (error instanceof Error && error.message.match(/API Request Error: 4\d\d/)) {
        return false;
    }
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let evChargerId: string | null = null;

  const allCommDevices: RawCommunicationDevice[] = [];
  // Use singular endpoint based on documentation for listing communication devices
  let commDevicesNextPageEndpoint: string | null = "/communication-device"; 

  try {
    while (commDevicesNextPageEndpoint) {
      const commDevicesResponse = await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, commDevicesNextPageEndpoint);
      allCommDevices.push(...commDevicesResponse.data);

      if (commDevicesResponse.links?.next) {
        const nextFullUrl = commDevicesResponse.links.next;
        if (nextFullUrl.startsWith(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING)) {
          commDevicesNextPageEndpoint = nextFullUrl.substring(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING.length);
          if (!commDevicesNextPageEndpoint.startsWith('/')) {
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
    
    // The primary inverter's serial number is found directly in the inverter object
    // associated with the communication device.
    // We assume the first device with an inverter serial is the primary.
    const primaryDevice = allCommDevices.find(device => device.inverter?.serial);
    if (primaryDevice && primaryDevice.inverter?.serial) {
        inverterSerial = primaryDevice.inverter.serial;
    }

    if (!inverterSerial) {
      const numDevices = allCommDevices.length;
      const deviceSerialsText = allCommDevices.map(d => d.serial_number).join(', ') || 'none';
      const errorMsg = `Failed to identify a primary inverter. Checked ${numDevices} communication device(s) (serials: [${deviceSerialsText}]). Ensure: API key is correct with full permissions, inverter is registered & online, and dongle is connected. Verify details on GivEnergy portal.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

  } catch (error: unknown) {
    let originalMessage = "Unknown error during communication device fetch";
     if (error instanceof Error) {
        originalMessage = error.message;
    } else if (typeof error === 'string') {
        originalMessage = error;
    }
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs (via proxy):", originalMessage, error);
    if (originalMessage && (originalMessage.toLowerCase().includes('network error:') || originalMessage.startsWith('API Request Error:') || originalMessage.startsWith('API Request Failed via Proxy:') || originalMessage.startsWith('GivEnergy API error:'))) {
        throw error; 
    }
    throw new Error(`Failed to retrieve essential device identifiers (communication devices pagination via proxy): ${originalMessage}`);
  }

  if (inverterSerial) {
    const allEVChargers: RawEVCharger[] = [];
    let evChargersNextPageEndpoint: string | null = "/ev-charger";
    try {
      while (evChargersNextPageEndpoint) {
        const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, evChargersNextPageEndpoint);
        allEVChargers.push(...evChargersResponse.data);
        
        if (evChargersResponse.links?.next) {
          const nextFullUrl = evChargersResponse.links.next;
          if (nextFullUrl.startsWith(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING)) {
            evChargersNextPageEndpoint = nextFullUrl.substring(GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING.length);
             if (!evChargersNextPageEndpoint.startsWith('/')) {
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

      // Assuming the first EV charger found is the one to be used.
      if (allEVChargers.length > 0 && allEVChargers[0].uuid) {
          evChargerId = allEVChargers[0].uuid;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key after checking all pages (via proxy).");
      }
    } catch (error: unknown) {
        let originalMessage = "Unknown error during EV charger list fetch";
        if (error instanceof Error) {
            originalMessage = error.message;
        } else if (typeof error === 'string') {
            originalMessage = error;
        }
        console.warn(`Could not fetch EV chargers list (pagination via proxy, optional): ${originalMessage}.`);
    }
  }

  if (!inverterSerial) { 
    throw new Error("Inverter serial could not be determined after device discovery.");
  }

  return { inverterSerial: inverterSerial!, evChargerId };
}

export async function getDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
    if (!apiKey) {
        throw new Error("API Key not provided for getDeviceIDs");
    }
    return _getPrimaryDeviceIDs(apiKey);
}

function mapEVChargerAPIStatus(apiStatus: string | undefined | null): EVChargerInternalStatus {
    if (!apiStatus) return "unavailable";
    const lowerApiStatus = apiStatus.toLowerCase().trim();

    // Direct mappings from OCPP 1.6 like statuses
    if (lowerApiStatus === "available") return "disconnected"; // "Available" means EV not plugged in
    if (lowerApiStatus === "preparing") return "preparing";
    if (lowerApiStatus === "charging") return "charging";
    if (lowerApiStatus === "suspendedevse" || lowerApiStatus === "suspendedev") return "suspended";
    if (lowerApiStatus === "finishing") return "finishing"; // OCPP Finishing (still plugged in, charge complete)
    if (lowerApiStatus === "reserved") return "reserved";
    if (lowerApiStatus === "unavailable") return "unavailable"; // Charger itself is unavailable
    if (lowerApiStatus === "faulted") return "faulted";

    // GivEnergy specific or other common terms that might imply an idle/standby state
    const idleLikeStates = ["eco", "eco+", "boost", "modbusslave", "vehicle connected", "standby", "paused", "plugged in"];
    if (idleLikeStates.some(s => lowerApiStatus.includes(s))) {
        // If it's "charging" already caught, otherwise consider these idle or preparing if not charging.
        // "vehicle connected" or "plugged in" but not "charging" could be "preparing" or simply "idle"
        // For simplicity, we'll map these to idle if not charging, as detailed power will confirm actual charging.
        return "idle"; 
    }
    
    console.warn(`Unknown EV Charger status from API: "${apiStatus}". Defaulting to "unavailable".`);
    return "unavailable";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  const { inverterSerial, evChargerId } = await getDeviceIDs(apiKey);

  const systemDataResponse = await _fetchGivEnergyAPI<RawSystemDataLatestResponse>(apiKey, `/inverter/${inverterSerial}/system-data/latest`);
  const rawData: RawSystemDataLatest = systemDataResponse.data;

  const homeConsumption: Metric = {
    value: parseFloat((rawData.consumption / 1000).toFixed(2)),
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
    value: "N/A", 
    unit: "kW",
    status: "unavailable", 
  };

  if (evChargerId && apiKey) { // Ensure apiKey is also checked here for safety
    try {
      // Attempt 1: Fetch detailed EV status from /status sub-endpoint
      const evStatusDetailedResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(apiKey, `/ev-charger/${evChargerId}/status`);
      const rawDetailedEVData: RawEVChargerStatusType = evStatusDetailedResponse.data;
      
      const powerInWatts = rawDetailedEVData.charge_session?.power;
      evCharger = {
        value: typeof powerInWatts === 'number' ? parseFloat((powerInWatts / 1000).toFixed(1)) : "N/A",
        unit: "kW",
        status: mapEVChargerAPIStatus(rawDetailedEVData.status),
      };
    } catch (errorDetailed) { // Catch any error from attempt 1
      let detailedMsg = `Failed to fetch detailed EV charger status for ${evChargerId} (attempt 1).`;
      if (errorDetailed instanceof Error) {
        detailedMsg += ` Error: ${errorDetailed.message}.`;
      } else if (typeof errorDetailed === 'string') {
        detailedMsg += ` Error: ${errorDetailed}.`;
      } else {
        detailedMsg += ` Unknown error type during detailed fetch.`;
      }
      console.warn(`${detailedMsg} Will attempt fallback.`);

      // Attempt 2: Fallback to basic EV charger info from /ev-charger/{uuid}
      try {
        const evBasicInfoResponse = await _fetchGivEnergyAPI<GivEnergyAPIData<RawEVCharger>>(apiKey, `/ev-charger/${evChargerId}`);
        const rawBasicEVData: RawEVCharger = evBasicInfoResponse.data;
        evCharger = {
          value: "N/A", // Basic info doesn't provide live power
          unit: "kW",
          status: mapEVChargerAPIStatus(rawBasicEVData.status),
        };
      } catch (errorBasic) { // Catch any error from attempt 2
        let basicMsg = `Failed to fetch basic EV charger info for ${evChargerId} (fallback attempt 2).`;
        if (errorBasic instanceof Error) {
          basicMsg += ` Error: ${errorBasic.message}.`;
        } else if (typeof errorBasic === 'string') {
          basicMsg += ` Error: ${errorBasic}.`;
        } else {
          basicMsg += ` Unknown error type during fallback fetch.`;
        }
        console.warn(`${basicMsg} Defaulting EV charger to unavailable.`);
        // Ensure evCharger is set to its default/error state from the initial declaration
        evCharger = {
            value: "N/A",
            unit: "kW",
            status: "unavailable",
        };
      }
    }
  } else {
    if (!evChargerId) {
        console.log("No EV Charger ID available, EV Charger data will be default/unavailable.");
    }
    // evCharger remains its initial default state
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
