
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
    
    if (originalMessage.startsWith("API Request Error:") || originalMessage.startsWith("GivEnergy API error:")) {
        throw new Error(originalMessage);
    }

    const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
    console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    throw new Error(errorMessage);
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    // Use singular based on latest understanding of docs for a simple list.
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-device");
    return true;
  } catch (error) {
    console.error("API Key validation failed via proxy:", error);
    if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthenticated"))) {
        return false;
    }
    // Check for any 4xx error as an indicator of invalid key or permissions issues.
    if (error instanceof Error && error.message.match(/API Request Error: 4\d\d/)) {
        return false;
    }
    // For other errors (like network issues to the proxy), validation is inconclusive / fails.
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let evChargerId: string | null = null;

  const allCommDevices: RawCommunicationDevice[] = [];
  // Use singular based on docs for communication device listing
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

  } catch (error: any) {
    console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs (via proxy):", error);
    if (error.message && (error.message.toLowerCase().includes('network error:') || error.message.startsWith('API Request Error:') || error.message.startsWith('API Request Failed via Proxy:') || error.message.startsWith('GivEnergy API error:'))) {
        throw error;
    }
    throw new Error(`Failed to retrieve essential device identifiers (communication devices pagination via proxy): ${error.message || 'An unknown error occurred.'}`);
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

      if (allEVChargers.length > 0 && allEVChargers[0].uuid) {
          evChargerId = allEVChargers[0].uuid;
      } else {
        console.log("No EV chargers found or EV charger data is incomplete for this API key after checking all pages (via proxy).");
      }
    } catch (error: any) {
        console.warn(`Could not fetch EV chargers list (pagination via proxy, optional): ${error.message}.`);
    }
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

    // Mapping based on GivEnergy API Docs for EV Charger status (OCPP 1.6 normalization)
    if (lowerApiStatus === "available") return "disconnected"; // "Available" means not plugged in.
    if (lowerApiStatus === "preparing") return "preparing";
    if (lowerApiStatus === "charging") return "charging";
    if (lowerApiStatus === "suspendedevse" || lowerApiStatus === "suspendedev") return "suspended";
    if (lowerApiStatus === "finishing") return "finishing"; // Or "completed" if better distinction needed
    if (lowerApiStatus === "reserved") return "reserved";
    if (lowerApiStatus === "unavailable") return "unavailable"; // Hardware issue, maintenance etc.
    if (lowerApiStatus === "faulted") return "faulted";
    
    // Additional GivEnergy specific modes or less common OCPP states if needed
    // e.g. some GivEnergy specific modes might imply "idle" if connected but not actively charging/faulted
    const idleLikeStates = ["eco", "eco+", "boost", "modbusslave", "vehicle connected", "standby", "paused", "plugged in"];
    if (idleLikeStates.some(s => lowerApiStatus.includes(s))) {
        // "vehicle connected" or similar could imply "idle" if not charging.
        return "idle"; 
    }
    
    console.warn(`Unknown EV Charger status from API: "${apiStatus}". Defaulting to "unavailable".`);
    return "unavailable";
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  const { inverterSerial, evChargerId } = await getDeviceIDs(apiKey);

  if (!inverterSerial) {
    throw new Error("Could not determine inverter serial. Cannot fetch real-time data.");
  }

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
    value: 0,
    unit: "kW",
    status: "unavailable", // Default to unavailable, will be updated if ID exists & fetch succeeds
  };

  if (evChargerId) {
    try {
      const evStatusDetailedResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(apiKey, `/ev-charger/${evChargerId}/status`);
      const rawDetailedEVData: RawEVChargerStatusType = evStatusDetailedResponse.data;
      
      const powerInWatts = rawDetailedEVData.charge_session?.power;
      evCharger = {
        value: typeof powerInWatts === 'number' ? parseFloat((powerInWatts / 1000).toFixed(1)) : 0,
        unit: "kW",
        status: mapEVChargerAPIStatus(rawDetailedEVData.status),
      };
    } catch (errorDetailed: unknown) {
      let caughtErrorMessage = "Unknown error during detailed EV status fetch";
      if (errorDetailed instanceof Error) {
        caughtErrorMessage = errorDetailed.message;
      } else if (typeof errorDetailed === 'string') {
        caughtErrorMessage = errorDetailed;
      } else {
        console.warn("Caught a non-standard error object for detailed EV status:", errorDetailed);
      }

      if (caughtErrorMessage.includes("404 Not Found") || caughtErrorMessage.includes("API Request Error: 404") || caughtErrorMessage.includes("GivEnergy API error: 404")) {
        console.warn(`EV Charger detailed status /ev-charger/${evChargerId}/status not found (404). Falling back to /ev-charger/${evChargerId}. Original error: ${caughtErrorMessage}`);
        try {
          const evBasicInfoResponse = await _fetchGivEnergyAPI<GivEnergyAPIData<RawEVCharger>>(apiKey, `/ev-charger/${evChargerId}`);
          const rawBasicEVData: RawEVCharger = evBasicInfoResponse.data;
          evCharger = {
            value: "N/A", 
            unit: "kW",
            status: mapEVChargerAPIStatus(rawBasicEVData.status),
          };
        } catch (errorBasic: unknown) {
          let basicErrorMessage = "Unknown error during basic EV info fetch";
            if (errorBasic instanceof Error) {
                basicErrorMessage = errorBasic.message;
            } else if (typeof errorBasic === 'string') {
                basicErrorMessage = errorBasic;
            } else {
                console.warn("Caught a non-standard error object for basic EV info:", errorBasic);
            }
          console.warn(`Failed to fetch basic EV charger (${evChargerId}) info after 404 on status endpoint: ${basicErrorMessage}. Defaulting to unavailable status.`);
          evCharger.status = "unavailable";
          evCharger.value = 0; 
        }
      } else {
        console.warn(`Failed to fetch EV charger (${evChargerId}) detailed status (non-404): ${caughtErrorMessage}. Defaulting to unavailable status.`);
        evCharger.status = "unavailable";
        evCharger.value = 0;
      }
    }
  } else {
    console.log("No EV Charger ID available, EV Charger data will be default/unavailable.");
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
