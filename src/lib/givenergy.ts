
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
    // Using singular based on documentation for listing.
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
  // Using singular endpoint based on documentation example for listing.
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
    
    // The primary inverter is usually the first one associated with a communication device.
    // The documentation for GET /communication-device shows `inverter.serial` directly.
    const primaryDevice = allCommDevices.find(device => device.inverter?.serial);
    if (primaryDevice && primaryDevice.inverter?.serial) {
        inverterSerial = primaryDevice.inverter.serial;
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
    if (originalMessage && (originalMessage.toLowerCase().includes('network error:') || originalMessage.startsWith('API Request Error:') || originalMessage.startsWith('API Request Failed via Proxy:') || originalMessage.startsWith('GivEnergy API error:') || originalMessage.startsWith('Failed to identify a primary inverter'))) {
        throw error; 
    }
    throw new Error(`Failed to retrieve essential device identifiers (communication devices pagination via proxy): ${originalMessage}`);
  }

  // Fetch EV Chargers if inverter was found
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

      // Assuming the first EV charger found is the primary one.
      // Documentation shows `uuid` for EV chargers.
      if (allEVChargers.length > 0 && allEVChargers[0].uuid) {
          evChargerId = allEVChargers[0].uuid;
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
        console.warn(`Could not fetch EV chargers list (pagination via proxy, this is optional): ${originalMessage}. EV Charger data will likely be unavailable.`);
        // Do not throw here, EV charger is optional.
    }
  }

  if (!inverterSerial) { 
    // This should ideally be caught earlier, but as a safeguard.
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

    // Direct mappings from OCPP 1.6 terms (or GivEnergy's interpretation)
    if (lowerApiStatus === "available") return "disconnected"; 
    if (lowerApiStatus === "preparing") return "preparing";
    if (lowerApiStatus === "charging") return "charging";
    if (lowerApiStatus === "suspendedevse") return "suspended_evse";
    if (lowerApiStatus === "suspendedev") return "suspended_ev";
    if (lowerApiStatus === "finishing") return "finishing"; 
    if (lowerApiStatus === "reserved") return "reserved";
    if (lowerApiStatus === "unavailable") return "unavailable"; 
    if (lowerApiStatus === "faulted") return "faulted";
    
    // GivEnergy specific terms that imply an idle/ready state when connected
    const idleLikeStates = [
        "eco", "eco+", "boost", "modbusslave", 
        "vehicle connected", "standby", "paused", 
        "plugged in", "idle", "connected", "stopped",
        "plugged_in_not_charging" // Common explicit state
    ];
     if (idleLikeStates.some(s => lowerApiStatus.includes(s))) {
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
    charging: batteryPowerWatts < -10 ? true : (batteryPowerWatts > 10 ? false : undefined),
  };

  const gridPowerWatts = rawData.grid.power;
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat((Math.abs(gridPowerWatts) / 1000).toFixed(2)),
    unit: "kW",
    flow: gridPowerWatts > 50 ? 'importing' : (gridPowerWatts < -50 ? 'exporting' : 'idle'),
  };

  // Calculate numeric power values in kW for internal logic
  const numericHomeConsumptionKW = rawData.consumption / 1000;
  const numericSolarGenerationKW = rawData.solar.power / 1000;
  const numericBatteryDischargeKW = batteryPowerWatts > 10 ? batteryPowerWatts / 1000 : 0; // Only positive power considered discharge
  const numericGridImportKW = gridPowerWatts > 50 ? gridPowerWatts / 1000 : 0; // Only positive power considered import

  let evCharger: EVChargerStatus = { 
    value: "N/A",
    unit: "kW",
    status: "unavailable",
  };

  if (evChargerId && apiKey) {
    const S_evChargerId = typeof evChargerId === 'string' ? evChargerId : 'unknown EV ID';
    let detailedStatusFetched = false;
    let evPowerInWatts: number | null | undefined = null;
    let evApiStatus: string | undefined | null = null;

    try {
      const evStatusDetailedResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(apiKey, `/ev-charger/${S_evChargerId}/status`);
      const rawDetailedEVData: RawEVChargerStatusType = evStatusDetailedResponse.data;
      
      evPowerInWatts = rawDetailedEVData.charge_session?.power;
      evApiStatus = rawDetailedEVData.status;
      detailedStatusFetched = true;
    } catch (errorDetailed) {
      console.warn("Detailed EV status fetch failed. Will attempt fallback.");
      // detailedStatusFetched remains false, allowing fallback. No re-throw.
    }

    if (!detailedStatusFetched) { 
      try {
        const evBasicInfoResponse = await _fetchGivEnergyAPI<GivEnergyAPIData<RawEVCharger>>(apiKey, `/ev-charger/${S_evChargerId}`);
        const rawBasicEVData: RawEVCharger = evBasicInfoResponse.data;
        // Basic info doesn't provide live power, so evPowerInWatts remains null or previous error state
        evApiStatus = rawBasicEVData.status; // Get status from basic info
      } catch (errorBasic) {
        console.warn("Fallback EV basic info fetch also failed. EV charger will be marked as unavailable.");
        evApiStatus = "unavailable"; // Explicitly set to default here
        evPowerInWatts = null;
      }
    }
    
    evCharger = {
      value: (typeof evPowerInWatts === 'number' && !isNaN(evPowerInWatts)) ? parseFloat((evPowerInWatts / 1000).toFixed(1)) : "N/A",
      unit: "kW",
      status: mapEVChargerAPIStatus(evApiStatus),
    };

  } else {
    if (!evChargerId) {
        console.log("No EV Charger ID available from device discovery, EV Charger data will be default/unavailable.");
    }
  }

  return {
    homeConsumption,
    solarGeneration,
    battery,
    grid,
    evCharger,
    timestamp: new Date(rawData.time).getTime() || Date.now(),
    numericHomeConsumptionKW,
    numericSolarGenerationKW,
    numericBatteryDischargeKW,
    numericGridImportKW,
  };
}

export async function getAccountDetails(apiKey: string): Promise<AccountData> {
  if (!apiKey) {
    throw new Error("API Key not provided for getAccountDetails");
  }
  const response = await _fetchGivEnergyAPI<RawAccountResponse>(apiKey, "/account");
  return response.data;
}

