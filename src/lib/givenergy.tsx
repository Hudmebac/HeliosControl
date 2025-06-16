
import type React from 'react';
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
  RawMeterDataLatestResponse,
  RawMeterDataLatest,
  DailyEnergyTotals,
} from "@/lib/types";

const PROXY_API_BASE_URL = "/api/proxy-givenergy";
const GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING = 'https://api.givenergy.cloud/v1';

// SIMULATED: In a real app, this should come from inverter settings or user configuration.
const SIMULATED_BATTERY_NOMINAL_CAPACITY_KWH = 13.5;


async function _fetchGivEnergyAPI<T>(
  apiKey: string,
  endpoint: string,
  options?: RequestInit & { suppressErrorForStatus?: number[] }
): Promise<T> {
  const headers = new Headers({
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  });

  const correctedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fetchUrl = `${PROXY_API_BASE_URL}${correctedEndpoint}`;
  const suppressErrorForStatus = options?.suppressErrorForStatus || [];

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
      if (!suppressErrorForStatus.includes(response.status)) {
        console.error(`GivEnergy API error for ${fetchUrl}: ${response.status}`, errorBody);
      }
      throw new Error(errorMessage); // Error is thrown regardless of suppression for logging
    }
    return response.json() as Promise<T>;
  } catch (error: unknown) {
    let originalMessage = "Unknown error during fetch operation";
    let statusCodeFromError: number | null = null;

    if (error instanceof Error) {
      originalMessage = error.message;
      const match = originalMessage.match(/API Request Error: (\d+)/);
      if (match && match[1]) {
        statusCodeFromError = parseInt(match[1], 10);
      }
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
    
    // Check if the status code extracted from the error message is in the suppress list
    if (statusCodeFromError && suppressErrorForStatus.includes(statusCodeFromError)) {
        // If the status code is suppressed, we still re-throw the error but don't log the generic proxy error message.
        // The calling function is responsible for handling it appropriately (e.g., with console.info for 404s).
    } else if (originalMessage.startsWith("API Request Error:") || originalMessage.startsWith("GivEnergy API error for") || originalMessage.startsWith("Network error:")) {
        // This means the error was already logged appropriately or is a network error that was logged.
        // No need for an additional generic log here.
    } else {
      // For truly unexpected errors not caught by the above, log the generic proxy error.
      const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
      console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    }
    throw error; // Re-throw the original error so the calling function can handle it
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-device");
    return true;
  } catch (error) {
    // Don't log "API Key validation failed" here if it's a suppressed error (like 401 being handled by the caller)
    // but for validateApiKey, any error usually means failure.
    // The console.error for the actual API call failure would happen inside _fetchGivEnergyAPI if not suppressed.
    if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthenticated"))) {
        return false;
    }
    if (error instanceof Error && error.message.match(/API Request Error: 4\d\d/)) {
        return false;
    }
    // If it's not a specific auth/client error, it might be network, etc.
    // To be safe for validation, treat most errors as a validation failure.
    // The detailed error would have been logged by _fetchGivEnergyAPI or the proxy route.
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let evChargerId: string | null = null;

  const allCommDevices: RawCommunicationDevice[] = [];
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
    // Error already logged by _fetchGivEnergyAPI if not suppressed, or by the block above for !inverterSerial
    // console.error("Error fetching or processing communication devices in _getPrimaryDeviceIDs (via proxy):", originalMessage, error);
    if (originalMessage && (originalMessage.toLowerCase().includes('network error:') || originalMessage.startsWith('API Request Error:') || originalMessage.startsWith('API Request Failed via Proxy:') || originalMessage.startsWith('GivEnergy API error:') || originalMessage.startsWith('Failed to identify a primary inverter'))) {
        throw error; // Re-throw errors that are already specific or critical
    }
    // For truly unhandled ones here, wrap them.
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
        // Error already logged by _fetchGivEnergyAPI if not suppressed.
        console.warn(`Could not fetch EV chargers list (pagination via proxy, this is optional): ${originalMessage}. EV Charger data will likely be unavailable.`);
    }
  }

  if (!inverterSerial) {
    // This case should be caught by the earlier check after comm device fetch,
    // but as a safeguard:
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

export function mapEVChargerAPIStatus(apiStatus: string | undefined | null): React.ReactNode {
    if (!apiStatus) return <span className="text-muted-foreground">Status Unknown</span>;
    const lowerApiStatus = apiStatus.toLowerCase().trim();

    if (lowerApiStatus === "available") return <span className="text-gray-400">Disconnected</span>;
    if (lowerApiStatus === "preparing") return <span className="text-blue-500">Preparing</span>;
    if (lowerApiStatus === "charging") return <span className="text-green-500">Charging</span>;
    if (lowerApiStatus === "suspendedevse") return <span className="text-yellow-600">Paused (Charger)</span>;
    if (lowerApiStatus === "suspendedev") return <span className="text-yellow-500">Paused (Vehicle)</span>;
    if (lowerApiStatus === "finishing") return <span className="text-blue-400">Finishing</span>;
    if (lowerApiStatus === "reserved") return <span className="text-purple-500">Reserved</span>;
    if (lowerApiStatus === "unavailable") return <span className="text-red-600">Unavailable</span>;
    if (lowerApiStatus === "faulted") return <span className="text-red-700">Faulted</span>;

    const idleLikeStates = [
        "eco", "eco+", "boost", "modbusslave",
        "vehicle connected", "standby", "paused",
        "plugged in", "idle", "connected", "stopped", "ready",
        "plugged_in_not_charging"
    ];
     if (idleLikeStates.some(s => lowerApiStatus.includes(s))) {
        return <span className="text-blue-500">Idle / Connected</span>;
    }

    console.warn(`Unknown EV Charger status from API: "${apiStatus}".`);
    return <span className="text-muted-foreground">{apiStatus}</span>;
}


export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  const { inverterSerial, evChargerId } = await getDeviceIDs(apiKey);

  const systemDataResponse = await _fetchGivEnergyAPI<RawSystemDataLatestResponse>(apiKey, `/inverter/${inverterSerial}/system-data/latest`);
  const rawData: RawSystemDataLatest = systemDataResponse.data;

  let dailyTotals: DailyEnergyTotals = {};
  try {
    const meterDataResponse = await _fetchGivEnergyAPI<RawMeterDataLatestResponse>(apiKey, `/inverter/${inverterSerial}/meter-data/latest`);
    const rawMeterData: RawMeterDataLatest = meterDataResponse.data;
    dailyTotals = {
        solar: rawMeterData.today.solar,
        gridImport: rawMeterData.today.grid.import,
        gridExport: rawMeterData.today.grid.export,
        batteryCharge: rawMeterData.today.battery.charge,
        batteryDischarge: rawMeterData.today.battery.discharge,
        consumption: rawMeterData.today.consumption,
        acCharge: rawMeterData.today.ac_charge
    };
  } catch (meterError) {
      // Error already logged by _fetchGivEnergyAPI if not suppressed.
      console.warn("Could not fetch daily meter data (optional):", meterError);
  }

  const consumptionWatts = typeof rawData.consumption === 'number' ? rawData.consumption : 0;
  const solarPowerWatts = typeof rawData.solar?.power === 'number' ? rawData.solar.power : 0;
  const gridPowerWatts = typeof rawData.grid?.power === 'number' ? rawData.grid.power : 0; // -ve for import, +ve for export
  const apiBatteryPowerWatts = typeof rawData.battery?.power === 'number' ? rawData.battery.power : 0; // -ve for charge, +ve for discharge
  const batteryPercentage = typeof rawData.battery?.percent === 'number' ? rawData.battery.percent : 0;

  const inferredBatteryPowerWattsCalculation = consumptionWatts - solarPowerWatts + gridPowerWatts;
  let effectiveBatteryPowerFlow = apiBatteryPowerWatts;

  const API_REPORTED_IDLE_THRESHOLD = 20; 
  const MIN_INFERRED_FLOW_TO_OVERRIDE = 20; 

  if (!isNaN(inferredBatteryPowerWattsCalculation)) {
    if (Math.abs(apiBatteryPowerWatts) < API_REPORTED_IDLE_THRESHOLD &&
        Math.abs(inferredBatteryPowerWattsCalculation) >= MIN_INFERRED_FLOW_TO_OVERRIDE) {
      effectiveBatteryPowerFlow = inferredBatteryPowerWattsCalculation;
    }
  }


  const homeConsumption: Metric = {
    value: parseFloat((consumptionWatts / 1000).toFixed(2)),
    unit: "kW",
  };

  const solarGeneration: Metric = {
    value: parseFloat((solarPowerWatts / 1000).toFixed(2)),
    unit: "kW",
  };

  const currentEnergyKWh = (batteryPercentage / 100) * SIMULATED_BATTERY_NOMINAL_CAPACITY_KWH;

  const battery: BatteryStatus = {
    value: batteryPercentage,
    unit: "%",
    percentage: batteryPercentage,
    rawPowerWatts: effectiveBatteryPowerFlow,
    energyKWh: parseFloat(currentEnergyKWh.toFixed(2)),
    capacityKWh: SIMULATED_BATTERY_NOMINAL_CAPACITY_KWH,
  };

  const GRID_IDLE_THRESHOLD_WATTS = 50;
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat((Math.abs(gridPowerWatts) / 1000).toFixed(2)),
    unit: "kW",
    flow: gridPowerWatts > GRID_IDLE_THRESHOLD_WATTS ? 'exporting' : (gridPowerWatts < -GRID_IDLE_THRESHOLD_WATTS ? 'importing' : 'idle'),
  };

  let evCharger: EVChargerStatus = {
    value: "N/A",
    unit: "kW",
    status: mapEVChargerAPIStatus("unavailable"),
  };

  if (evChargerId && apiKey) {
    const S_evChargerId = typeof evChargerId === 'string' ? evChargerId : 'unknown EV ID';
    let evPowerInWatts: number | null | undefined = null;
    let evApiStatusString: string | undefined | null = "unavailable";

    try {
      const evStatusDetailedResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(
        apiKey,
        `/ev-charger/${S_evChargerId}/status`,
        { suppressErrorForStatus: [404] } 
      );
      const rawDetailedEVData: RawEVChargerStatusType = evStatusDetailedResponse.data;
      evPowerInWatts = rawDetailedEVData.charge_session?.power;
      evApiStatusString = rawDetailedEVData.status;
    } catch (errorDetailed: any) {
      if (errorDetailed?.message?.includes("404") || errorDetailed?.message?.includes("Not Found")) {
         console.info(`Detailed EV status endpoint (/ev-charger/${S_evChargerId}/status) not found or returned 404. This is expected for some EV charger setups. Attempting fallback to basic EV info. Original error: ${errorDetailed.message}`);
      } else {
        // For other errors, log a warning, as it might indicate a different issue.
        // _fetchGivEnergyAPI would have already logged if it wasn't suppressed.
        console.warn(`Detailed EV status fetch failed for ${S_evChargerId}. Attempting fallback. Error: ${errorDetailed instanceof Error ? errorDetailed.message : String(errorDetailed)}`);
      }
      // Attempt fallback regardless of the specific error for detailed status
      try {
        const evBasicInfoResponse = await _fetchGivEnergyAPI<GivEnergyAPIData<RawEVCharger>>(apiKey, `/ev-charger/${S_evChargerId}`);
        evApiStatusString = evBasicInfoResponse.data.status;
      } catch (errorBasic) {
         // _fetchGivEnergyAPI would log this error if not suppressed.
        console.warn(`Fallback EV basic info fetch also failed for ${S_evChargerId}. EV charger will be marked as unavailable. Error: ${errorBasic instanceof Error ? errorBasic.message : String(errorBasic)}`);
        evApiStatusString = "unavailable";
      }
    }

    evCharger = {
      value: (typeof evPowerInWatts === 'number' && !isNaN(evPowerInWatts)) ? parseFloat((evPowerInWatts / 1000).toFixed(1)) : "N/A",
      unit: "kW",
      status: mapEVChargerAPIStatus(evApiStatusString),
    };

  } else {
    if (!evChargerId) {
        // This is an expected scenario if no EV charger is found.
        // console.log("No EV Charger ID available, EV Charger data will be default/unavailable.");
    }
  }

  const dataToReturn: RealTimeData = {
    homeConsumption,
    solarGeneration,
    battery,
    grid,
    evCharger,
    timestamp: new Date(rawData.time).getTime() || Date.now(),
    rawHomeConsumptionWatts: consumptionWatts,
    rawSolarPowerWatts: solarPowerWatts,
    rawGridPowerWatts: gridPowerWatts,
    rawBatteryPowerWattsFromAPI: apiBatteryPowerWatts,
    inferredRawBatteryPowerWatts: !isNaN(inferredBatteryPowerWattsCalculation) ? inferredBatteryPowerWattsCalculation : undefined,
    today: dailyTotals,
  };

  return dataToReturn;
}

export async function getAccountDetails(apiKey: string): Promise<AccountData> {
  if (!apiKey) {
    throw new Error("API Key not provided for getAccountDetails");
  }
  const response = await _fetchGivEnergyAPI<RawAccountResponse>(apiKey, "/account");
  return response.data;
}

