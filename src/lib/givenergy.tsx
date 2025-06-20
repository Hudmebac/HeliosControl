
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
  EnergyFlowRawEntry,
  EnergyFlowApiResponse,
  EnergyFlowTypeID,
  ENERGY_FLOW_TYPE_DETAILS, // Import for checking count
} from "@/lib/types";
import { format, parseISO } from 'date-fns';


const PROXY_API_BASE_URL = "/api/proxy-givenergy";
const GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING = 'https://api.givenergy.cloud/v1';

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

      let detailMessage = errorBody?.error || errorBody?.message;
      if (typeof detailMessage === 'object' && detailMessage !== null) {
        try {
          detailMessage = JSON.stringify(detailMessage);
        } catch (e) {
          detailMessage = "Invalid error detail object";
        }
      } else if (detailMessage === null || detailMessage === undefined) {
        detailMessage = "";
      }
      
      const errorMessage = `API Request Error: ${response.status} ${response.statusText}${detailMessage ? ` - Detail: ${String(detailMessage)}` : ''}`;


      if (!suppressErrorForStatus.includes(response.status)) {
        console.error(`GivEnergy API error for ${fetchUrl}: ${response.status} ${response.statusText}`, errorBody);
      }
      throw new Error(errorMessage);
    }
    return response.json() as Promise<T>;
  } catch (error: unknown) {
    let originalMessage = "Unknown error during fetch operation";
    let statusCodeFromError: number | null = null;

    if (error instanceof Error) {
      originalMessage = error.message;
      const match = originalMessage.match(/^API Request Error: (\d+)/);
      if (match && match[1]) {
        statusCodeFromError = parseInt(match[1], 10);
      }
    } else if (typeof error === 'string') {
      originalMessage = error;
    } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as {message: any}).message === 'string') {
      originalMessage = (error as {message: string}).message;
    }

    if (statusCodeFromError && suppressErrorForStatus.includes(statusCodeFromError)) {
        // Suppressed error, do not log the generic "API Request Failed via Proxy"
    } else if (error instanceof TypeError &&
        (originalMessage.toLowerCase().includes('failed to fetch') ||
         originalMessage.toLowerCase().includes('networkerror') ||
         originalMessage.toLowerCase().includes('load failed'))) {
      const detailedMessage = `Network error: Could not connect to the application's API proxy (${PROXY_API_BASE_URL}). Please check your internet connection and ensure the application server is running. (Original error: ${originalMessage})`;
      console.error("Network error detail from _fetchGivEnergyAPI (proxy call):", detailedMessage);
    } else if (originalMessage.startsWith('API Request Error:') ||
               originalMessage.toLowerCase().includes('network error:') ||
               originalMessage.startsWith('API Request Failed via Proxy:') ||
               originalMessage.startsWith('GivEnergy API error for') ||
               originalMessage.startsWith('GivEnergy API error:')) {
        // Error is already specific or a known type, rely on earlier logs or specific handling
    } else {
      // For truly unexpected errors not caught by the above, log the generic proxy error.
      const errorMessage = `API Request Failed via Proxy: ${originalMessage}`;
      console.error("Throwing generic API request error from _fetchGivEnergyAPI (proxy call):", errorMessage);
    }
    throw error;
  }
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    await _fetchGivEnergyAPI<RawCommunicationDevicesResponse>(apiKey, "/communication-device");
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthenticated") || error.message.match(/API Request Error: 4\d\d/))) {
        return false;
    }
    return false;
  }
}

async function _getPrimaryDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  let inverterSerial: string | null = null;
  let evChargerId: string | null = null;
  let batteryNominalCapacityKWh: number | null = null;

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
        const batteryInfo = primaryDevice.inverter.info?.battery;
        if (batteryInfo && typeof batteryInfo.nominal_capacity === 'number' && typeof batteryInfo.nominal_voltage === 'number' && batteryInfo.nominal_capacity > 0 && batteryInfo.nominal_voltage > 0) {
            batteryNominalCapacityKWh = (batteryInfo.nominal_capacity * batteryInfo.nominal_voltage) / 1000;
        } else {
            console.warn("Could not determine battery nominal capacity from primary device info. Nominal capacity details missing or invalid:", batteryInfo);
        }
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
    if (originalMessage && (originalMessage.toLowerCase().includes('network error:') || originalMessage.startsWith('API Request Error:') || originalMessage.startsWith('API Request Failed via Proxy:') || originalMessage.startsWith('GivEnergy API error:') || originalMessage.startsWith('Failed to identify a primary inverter'))) {
        throw error;
    }
    throw new Error(`Failed to retrieve essential device identifiers (communication devices pagination via proxy): ${originalMessage}`);
  }

  if (inverterSerial) {
    const allEVChargers: RawEVCharger[] = [];
    let evChargersNextPageEndpoint: string | null = "/ev-charger";
    try {
      while (evChargersNextPageEndpoint) {
        const evChargersResponse = await _fetchGivEnergyAPI<RawEVChargersResponse>(apiKey, evChargersNextPageEndpoint, {suppressErrorForStatus: [404]});
        if (evChargersResponse && evChargersResponse.data) {
            allEVChargers.push(...evChargersResponse.data);
        }


        if (evChargersResponse?.links?.next) {
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
        console.info("No EV chargers found or EV charger data is incomplete for this API key after checking all pages (via proxy). EV charger data may be unavailable.");
      }
    } catch (error: unknown) {
        let originalMessage = "Unknown error during EV charger list fetch";
        if (error instanceof Error) {
            originalMessage = error.message;
            if (originalMessage.includes("404")) {
                console.info(`EV charger list endpoint (/ev-charger) returned 404. This is expected if no EV chargers are set up. Original error: ${originalMessage}`);
                evChargersNextPageEndpoint = null;
            } else {
                 console.warn(`Could not fetch EV chargers list (pagination via proxy, this is optional): ${originalMessage}. EV Charger data will likely be unavailable.`);
            }
        } else if (typeof error === 'string') {
            originalMessage = error;
            console.warn(`Could not fetch EV chargers list (pagination via proxy, this is optional): ${originalMessage}. EV Charger data will likely be unavailable.`);
        } else {
            console.warn(`An unknown error occurred while fetching EV chargers list: ${String(error)}`);
        }
    }
  }

  if (!inverterSerial) {
    throw new Error("Inverter serial could not be determined after device discovery and EV charger search.");
  }

  return { inverterSerial: inverterSerial!, evChargerId, batteryNominalCapacityKWh };
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
  const { inverterSerial, evChargerId, batteryNominalCapacityKWh } = await getDeviceIDs(apiKey);

  if (!inverterSerial) {
    throw new Error("Inverter serial not found, cannot fetch real-time data.");
  }

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
      console.warn("Could not fetch daily meter data (optional):", meterError);
  }

  const consumptionWatts = typeof rawData.consumption === 'number' ? rawData.consumption : 0;
  const solarPowerWatts = typeof rawData.solar?.power === 'number' ? rawData.solar.power : 0;
  const gridPowerWatts = typeof rawData.grid?.power === 'number' ? rawData.grid.power : 0;
  const apiBatteryPowerWatts = typeof rawData.battery?.power === 'number' ? rawData.battery.power : 0;
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

  const actualCapacityKWh = batteryNominalCapacityKWh !== null && batteryNominalCapacityKWh > 0 ? batteryNominalCapacityKWh : undefined;
  const currentEnergyKWh = actualCapacityKWh ? (batteryPercentage / 100) * actualCapacityKWh : undefined;


  const battery: BatteryStatus = {
    value: batteryPercentage,
    unit: "%",
    percentage: batteryPercentage,
    rawPowerWatts: effectiveBatteryPowerFlow,
    energyKWh: currentEnergyKWh !== undefined ? parseFloat(currentEnergyKWh.toFixed(2)) : undefined,
    capacityKWh: actualCapacityKWh !== undefined ? parseFloat(actualCapacityKWh.toFixed(2)) : undefined,
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
    rawStatus: "unavailable",
    dailyTotalKWh: dailyTotals.acCharge || 0,
    sessionKWhDelivered: undefined,
  };
   let evApiStatusString: string | undefined | null = "unavailable";

  if (evChargerId && apiKey) {
    const S_evChargerId = typeof evChargerId === 'string' ? evChargerId : 'unknown EV ID';
    let evPowerInWatts: number | null | undefined = null;
    let sessionKWh: number | undefined = undefined;

    try {
      const evStatusDetailedResponse = await _fetchGivEnergyAPI<RawEVChargerStatusResponse>(
        apiKey,
        `/ev-charger/${S_evChargerId}/status`,
        { suppressErrorForStatus: [404] }
      );
      const rawDetailedEVData: RawEVChargerStatusType = evStatusDetailedResponse.data;
      evPowerInWatts = rawDetailedEVData.charge_session?.power;
      evApiStatusString = rawDetailedEVData.status;
      sessionKWh = rawDetailedEVData.charge_session?.kwh_delivered;

    } catch (errorDetailed: any) {
      if (errorDetailed?.message?.includes("API Request Error: 404") || errorDetailed?.message?.includes("Not Found")) {
         console.info(`Detailed EV status endpoint (/ev-charger/${S_evChargerId}/status) not found or returned 404. This is expected for some EV charger setups. Attempting fallback to basic EV info. Original error: ${errorDetailed.message}`);
      } else {
        console.warn(`Detailed EV status fetch failed for ${S_evChargerId}. Attempting fallback. Error: ${errorDetailed instanceof Error ? errorDetailed.message : String(errorDetailed)}`);
      }
      try {
        const evBasicInfoResponse = await _fetchGivEnergyAPI<GivEnergyAPIData<RawEVCharger>>(apiKey, `/ev-charger/${S_evChargerId}`);
        evApiStatusString = evBasicInfoResponse.data.status;
      } catch (errorBasic) {
        console.warn(`Fallback EV basic info fetch also failed for ${S_evChargerId}. EV charger will be marked as unavailable. Error: ${errorBasic instanceof Error ? errorBasic.message : String(errorBasic)}`);
        evApiStatusString = "unavailable";
      }
    }

    evCharger = {
      value: (typeof evPowerInWatts === 'number' && !isNaN(evPowerInWatts)) ? parseFloat((evPowerInWatts / 1000).toFixed(1)) : "N/A",
      unit: "kW",
      status: mapEVChargerAPIStatus(evApiStatusString),
      rawStatus: evApiStatusString || "unavailable",
      dailyTotalKWh: dailyTotals.acCharge || 0,
      sessionKWhDelivered: typeof sessionKWh === 'number' ? parseFloat(sessionKWh.toFixed(1)) : undefined,
    };

  } else {
    if (!evChargerId) {
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
    today: dailyTotals
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


// This function is deprecated and replaced by getEnergyFlows.
// Keeping it here to avoid breaking existing code, but it should be removed.
export async function getHistoricalEnergyData(
  apiKey: string,
  inverterSerial: string,
  startDate: Date,
  endDate: Date,
  groupingValue: number
): Promise<any[]> { // Changed return type to any[] for broader compatibility
    console.warn("getHistoricalEnergyData is deprecated. Use getEnergyFlows instead.");
    const startTimeFormatted = format(startDate, "yyyy-MM-dd");
    const endTimeFormatted = format(endDate, "yyyy-MM-dd");

    try {
        const rawFlows = await getEnergyFlows(apiKey, inverterSerial, startTimeFormatted, endTimeFormatted, groupingValue);
        return rawFlows.map(dailyEntry => {
            const flows = dailyEntry.data;
            const solarToHome = flows['0'] || 0;
            const solarToBattery = flows['1'] || 0;
            const solarToGrid = flows['2'] || 0;
            const gridToHome = flows['3'] || 0;
            const gridToBattery = flows['4'] || 0;
            const batteryToHome = flows['5'] || 0;
            const batteryToGrid = flows['6'] || 0;

            const totalSolarGeneration = solarToHome + solarToBattery + solarToGrid;
            const totalGridImport = gridToHome + gridToBattery;
            const totalGridExport = solarToGrid + batteryToGrid;
            const totalBatteryCharge = solarToBattery + gridToBattery;
            const totalBatteryDischarge = batteryToHome + batteryToGrid;
            const totalHomeConsumption = solarToHome + gridToHome + batteryToHome;

            return {
              date: parseISO(dailyEntry.start_time.split(' ')[0]), // Return as Date object
              solarGeneration: parseFloat(totalSolarGeneration.toFixed(2)),
              gridImport: parseFloat(totalGridImport.toFixed(2)),
              gridExport: parseFloat(totalGridExport.toFixed(2)),
              batteryCharge: parseFloat(totalBatteryCharge.toFixed(2)),
              batteryDischarge: parseFloat(totalBatteryDischarge.toFixed(2)),
              consumption: parseFloat(totalHomeConsumption.toFixed(2)),
              solarToHome: parseFloat(solarToHome.toFixed(2)),
              solarToBattery: parseFloat(solarToBattery.toFixed(2)),
              solarToGrid: parseFloat(solarToGrid.toFixed(2)),
              batteryToHome: parseFloat(batteryToHome.toFixed(2)),
              gridToHome: parseFloat(gridToHome.toFixed(2)),
            };
        }).sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch(error) {
        console.error("Error in deprecated getHistoricalEnergyData (using getEnergyFlows):", error);
        throw error;
    }
}


export async function getEnergyFlows(
  apiKey: string,
  inverterSerial: string,
  startTime: string,
  endTime: string,
  grouping: number,
  types?: EnergyFlowTypeID[] // Expects an array of string IDs like "0", "1", etc.
): Promise<EnergyFlowRawEntry[]> {
  if (!apiKey || !inverterSerial) {
    throw new Error("API Key or Inverter Serial not provided for energy flows.");
  }

  const ALL_POSSIBLE_TYPE_IDS_COUNT = Object.keys(ENERGY_FLOW_TYPE_DETAILS).length;

  const body: {
    start_time: string;
    end_time: string;
    grouping: number;
    types?: number[]; // API expects number array for types
  } = {
    start_time: startTime,
    end_time: endTime,
    grouping: grouping,
  };

  if (types && types.length > 0) {
    // If the number of selected types is less than the total number of possible flow types,
    // it means the user has specifically filtered, so send those specific types.
    // Otherwise (if all types are effectively selected), omit the 'types' parameter
    // to let the API default to "all types" as per documentation ("Leave blank to fetch all types").
    if (types.length < ALL_POSSIBLE_TYPE_IDS_COUNT) {
      body.types = types.map(Number); // Convert string IDs to numbers for the API
    }
    // If types.length === ALL_POSSIBLE_TYPE_IDS_COUNT, body.types remains undefined,
    // so it will not be included in the JSON.stringify, effectively omitting it.
  }
  // If 'types' was initially undefined or empty, body.types also remains undefined.

  console.log("[getEnergyFlows] Request Body Sent:", JSON.stringify(body, null, 2));

  const response = await _fetchGivEnergyAPI<EnergyFlowApiResponse>(
    apiKey,
    `/inverter/${inverterSerial}/energy-flows`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  console.log("[getEnergyFlows] Raw API Response:", JSON.stringify(response, null, 2));

  // Handle cases where response.data might be an empty object {} instead of an array
  if (response && response.data && !Array.isArray(response.data) && Object.keys(response.data).length === 0) {
    return []; // Treat empty object as no data entries
  }
  return (response && response.data && Array.isArray(response.data)) ? response.data : [];
}

