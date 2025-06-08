
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
  EVChargerInternalStatus,
  RawSystemDataLatest,
  RawEVChargerStatus as RawEVChargerStatusType,
  GivEnergyAPIData,
  AccountData,
  RawAccountResponse,
  GivEnergyPaginatedResponse,
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
        // Non-JSON error response or empty body, errorBody remains {}
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
    
    // Re-throw if it's already a specific API error or network error we've formatted.
    if (originalMessage.startsWith("API Request Error:") || originalMessage.startsWith("GivEnergy API error for") || originalMessage.startsWith("Network error:")) {
        throw error; 
    }

    // Otherwise, wrap it as a generic proxy failure.
    const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Use singular endpoint as per documentation examples for listing.
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-device");
    return true;
  } catch (error) {
    console.error("API Key validation failed via proxy:", error);
    if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthenticated"))) {
        return false;
    }
    // Check for any 4xx client error
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
  // Use singular endpoint as per documentation for listing devices.
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
    
    // Find the first device that has an inverter serial.
    const primaryDevice = allCommDevices.find(device => device.inverter?.serial);
    if (primaryDevice && primaryDevice.inverter?.serial) {
        inverterSerial = primaryDevice.inverter.serial;
    }

    if (!inverterSerial && allCommDevices.length > 0) {
      // Fallback: if no device explicitly has inverter.serial, but devices exist,
      // check if any device *itself* has a serial that could be an inverter.
      // This is less ideal as `communication-device`'s `serial_number` is for the dongle.
      // The primary logic relies on `device.inverter.serial`.
      // For now, we stick to finding device.inverter.serial.
    }
    
    if (!inverterSerial) {
      const numDevices = allCommDevices.length;
      const deviceSerialsText = allCommDevices.map(d => d.serial_number).join(', ') || 'none';
      const errorMsg = `Failed to identify a primary inverter. Checked ${numDevices} communication device(s) (dongle serials: [${deviceSerialsText}]). Ensure: API key is correct with full permissions, inverter is registered & online, and dongle is connected to the inverter. Verify details on GivEnergy portal.`;
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
    // Re-throw if it's an error we've already specifically formatted or a known API error structure
    if (originalMessage && (originalMessage.toLowerCase().includes('network error:') || originalMessage.startsWith('API Request Error:') || originalMessage.startsWith('API Request Failed via Proxy:') || originalMessage.startsWith('GivEnergy API error:') || originalMessage.startsWith('Failed to identify a primary inverter'))) {
        throw error; 
    }
    throw new Error(`Failed to retrieve essential device identifiers (communication devices pagination via proxy): ${originalMessage}`);
  }

  // Fetch EV Chargers
  if (inverterSerial) { // Only try to find EV chargers if we have an inverter
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

      if (allEVChargers.length > 0 && allEVChargers[0].uuid) {
          evChargerId = allEVChargers[0].uuid; // Taking the first EV charger found
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key after checking all pages (via proxy). EV charger data may be unavailable.");
      }
    } catch (error: unknown) {
        let originalMessage = "Unknown error during EV charger list fetch";
        if (error instanceof Error) {
            originalMessage = error.message;
        } else if (typeof error === 'string') {
            originalMessage = error;
        }
        // This is not critical for dashboard core functionality if EV charger is not present/used
        console.warn(`Could not fetch EV chargers list (pagination via proxy, this is optional): ${originalMessage}. EV Charger data will likely be unavailable.`);
        // evChargerId remains null
    }
  }

  if (!inverterSerial) { 
    // This should have been caught earlier, but as a safeguard:
    throw new Error("Inverter serial could not be determined after device discovery and EV charger search.");
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

    // Direct OCPP 1.6 mappings from documentation
    if (lowerApiStatus === "available") return "disconnected"; // "Available" means not plugged in
    if (lowerApiStatus === "preparing") return "preparing";
    if (lowerApiStatus === "charging") return "charging";
    if (lowerApiStatus === "suspendedevse") return "suspended"; // Covers SuspendedEVSE
    if (lowerApiStatus === "suspendedev") return "suspended";   // Covers SuspendedEV
    if (lowerApiStatus === "finishing") return "finishing";
    if (lowerApiStatus === "reserved") return "reserved";
    if (lowerApiStatus === "unavailable") return "unavailable"; // Device itself is unavailable/out of service
    if (lowerApiStatus === "faulted") return "faulted";
    
    // GivEnergy specific or other common terms that might imply an idle but connected state
    const idleLikeStates = ["eco", "eco+", "boost", "modbusslave", "vehicle connected", "standby", "paused", "plugged in", "idle", "connected"];
     if (idleLikeStates.some(s => lowerApiStatus.includes(s))) {
        return "idle"; 
    }
    
    console.warn(`Unknown EV Charger status from API: "${apiStatus}". Defaulting to "unavailable".`);
    return "unavailable"; // Default for unmapped statuses
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
    charging: batteryPowerWatts < -10 ? true : (batteryPowerWatts > 10 ? false : undefined), // Adding a small deadband
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

  if (evChargerId && apiKey) {
    let detailedStatusFetched = false;
    try {
      const evStatusDetailedResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(apiKey, `/ev-charger/${evChargerId}/status`);
      const rawDetailedEVData: RawEVChargerStatusType = evStatusDetailedResponse.data;
      
      const powerInWatts = rawDetailedEVData.charge_session?.power;
      evCharger = {
        value: typeof powerInWatts === 'number' ? parseFloat((powerInWatts / 1000).toFixed(1)) : "N/A",
        unit: "kW",
        status: mapEVChargerAPIStatus(rawDetailedEVData.status),
      };
      detailedStatusFetched = true;
    } catch (errorDetailed) {
      let S_evChargerId = typeof evChargerId === 'string' ? evChargerId : 'unknown ID';
      let S_detailedErrorMsg = "Failed to fetch detailed EV charger status due to an unknown error type.";

      if (errorDetailed instanceof Error) {
        S_detailedErrorMsg = errorDetailed.message;
      } else if (typeof errorDetailed === 'string') {
        S_detailedErrorMsg = errorDetailed;
      } else if (typeof errorDetailed === 'object' && errorDetailed !== null && 'message' in errorDetailed) {
        const msg = (errorDetailed as { message: unknown }).message;
        S_detailedErrorMsg = typeof msg === 'string' ? msg : "Object contained a non-string message for detailed EV fetch.";
      }
      console.warn(`Detailed EV status fetch for ${S_evChargerId} failed (attempt 1): ${S_detailedErrorMsg}. Will attempt fallback.`);
      // detailedStatusFetched remains false, error is handled, proceed to fallback.
    }

    if (!detailedStatusFetched) { 
      try {
        const evBasicInfoResponse = await _fetchGivEnergyAPI<GivEnergyAPIData<RawEVCharger>>(apiKey, `/ev-charger/${evChargerId}`);
        const rawBasicEVData: RawEVCharger = evBasicInfoResponse.data;
        evCharger = {
          value: "N/A", 
          unit: "kW",
          status: mapEVChargerAPIStatus(rawBasicEVData.status),
        };
      } catch (errorBasic) {
        let S_evChargerId = typeof evChargerId === 'string' ? evChargerId : 'unknown ID';
        let S_basicErrorMsg = "Failed to fetch basic EV charger info due to an unknown error type.";

        if (errorBasic instanceof Error) {
          S_basicErrorMsg = errorBasic.message;
        } else if (typeof errorBasic === 'string') {
          S_basicErrorMsg = errorBasic;
        } else if (typeof errorBasic === 'object' && errorBasic !== null && 'message' in errorBasic) {
          const msg = (errorBasic as { message: unknown }).message;
          S_basicErrorMsg = typeof msg === 'string' ? msg : "Object contained a non-string message for basic EV info fetch.";
        }
        console.warn(`Fallback EV basic info fetch for ${S_evChargerId} also failed (attempt 2): ${S_basicErrorMsg}. Defaulting EV charger to unavailable.`);
        evCharger = { value: "N/A", unit: "kW", status: "unavailable" }; 
      }
    }
  } else {
    if (!evChargerId) {
        console.log("No EV Charger ID available from device discovery, EV Charger data will be default/unavailable.");
    }
     evCharger = { value: "N/A", unit: "kW", status: "unavailable" }; 
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

export async function getAccountDetails(apiKey: string): Promise<AccountData> {
  if (!apiKey) {
    throw new Error("API Key not provided for getAccountDetails");
  }
  // Assuming the response for /account is not paginated and directly returns { data: AccountData }
  const response = await _fetchGivEnergyAPI<RawAccountResponse>(apiKey, "/account");
  return response.data;
}

    