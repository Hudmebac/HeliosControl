
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
  HistoricalEnergyDataPoint,
  EnergyFlowRawEntry, 
  EnergyFlowApiResponse, 
  EnergyFlowTypeID, 
} from "@/lib/types";
import { ENERGY_FLOW_TYPE_DETAILS } from "@/lib/types";
import { format, parseISO } from 'date-fns';


const PROXY_API_BASE_URL = "/api/proxy-givenergy";
const GIVENERGY_API_V1_BASE_URL_FOR_STRIPPING = 'https://api.givenergy.cloud/v1';

export async function _fetchGivEnergyAPI<T>(
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
  
  try {
    const response = await fetch(fetchUrl, {
      ...options,
      method: options?.method || 'GET',
      headers,
    });

    if (!response.ok) {
      // Gracefully handle suppressed statuses first
      if (options?.suppressErrorForStatus?.includes(response.status)) {
        return {} as T;
      }
      
      // If not suppressed, proceed with error handling
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch (e) {
        // Non-JSON error response or empty body
      }

      const detailMessage = errorBody?.error || errorBody?.message || "No additional details from API.";
      const errorMessage = `API Request Error: ${response.status} ${response.statusText}. Detail: ${detailMessage}`;
      
      throw new Error(errorMessage);
    }
    
    return response.json() as Promise<T>;

  } catch (error) {
    // This catch block handles network errors (e.g., failed to fetch) or errors thrown above.
    console.error(`_fetchGivEnergyAPI failed for endpoint ${endpoint}:`, error);
    // Re-throw the error to be handled by the component that made the call.
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

export function mapEVChargerAPIStatus(apiStatus: string | undefined | null): string {
    if (!apiStatus) return "Status Unknown";
    const lowerApiStatus = apiStatus.toLowerCase().trim();

    if (lowerApiStatus === "available") return "Disconnected";
    if (lowerApiStatus === "preparing") return "Preparing";
    if (lowerApiStatus === "charging") return "Charging";
    if (lowerApiStatus === "suspendedevse") return "Paused (Charger)";
    if (lowerApiStatus === "suspendedev") return "Paused (Vehicle)";
    if (lowerApiStatus === "finishing") return "Finishing";
    if (lowerApiStatus === "reserved") return "Reserved";
    if (lowerApiStatus === "unavailable") return "Unavailable";
    if (lowerApiStatus === "faulted") return "Faulted";

    const idleLikeStates = [
        "eco", "eco+", "boost", "modbusslave",
        "vehicle connected", "standby", "paused",
        "plugged in", "idle", "connected", "stopped", "ready",
        "plugged_in_not_charging"
    ];
     if (idleLikeStates.some(s => lowerApiStatus.includes(s))) {
        return "Idle / Connected";
    }

    console.warn(`Unknown EV Charger status from API: "${apiStatus}".`);
    return apiStatus;
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

export async function getEnergyFlows(
  apiKey: string,
  inverterSerial: string,
  startTime: string, // Expected format "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  endTime: string,   // Expected format "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  grouping: number,  // API grouping ID (0-4)
  types?: EnergyFlowTypeID[]
): Promise<EnergyFlowRawEntry[]> {
  if (!apiKey || !inverterSerial) {
    throw new Error("API Key or Inverter Serial not provided for energy flows.");
  }

  const body: {
    start_time: string;
    end_time: string;
    grouping: number;
    types?: number[];
  } = {
    start_time: startTime,
    end_time: endTime,
    grouping: grouping,
  };

  if (types && types.length > 0) {
    body.types = types.map(Number);
  }

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

  if (response && response.data) {
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // Check if response.data is an object and not empty
    if (typeof response.data === 'object' && Object.keys(response.data).length > 0) {
      // Convert the object's values into an array of EnergyFlowRawEntry
      return Object.values(response.data);
    }
    // If response.data is an empty object {}
    if (typeof response.data === 'object' && Object.keys(response.data).length === 0) {
        return [];
    }
  }
  return []; // Default to empty array if data is missing or in an unexpected format
}
