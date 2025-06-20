
export interface Metric {
  value: number | string; // Can be number (power) or string (percentage)
  unit: string;
}

export type EVChargerInternalStatus = // This is now a ReactNode
  | React.ReactNode;


export interface BatteryStatus extends Metric {
  charging?: boolean;
  percentage: number;
  rawPowerWatts: number; // Added to store the effective power flow for the battery
  energyKWh?: number; // Current energy stored in kWh
  capacityKWh?: number; // Total battery capacity in kWh
}

export interface EVChargerStatus extends Metric {
  status: EVChargerInternalStatus;
  rawStatus?: string; // Raw status string from API
  dailyTotalKWh?: number; // Total energy consumed by charger today
  sessionKWhDelivered?: number; // Energy delivered in the current/most recent session
}

// For daily totals from meter-data/latest
export interface DailyEnergyTotals {
  solar?: number; // kWh
  gridImport?: number; // kWh
  gridExport?: number; // kWh
  batteryCharge?: number; // kWh
  batteryDischarge?: number; // kWh
  consumption?: number; // kWh
  acCharge?: number; // kWh (often EV charging total for the day)
}


export interface RealTimeData {
  homeConsumption: Metric;
  solarGeneration: Metric;
  battery: BatteryStatus;
  grid: Metric & { flow: 'importing' | 'exporting' | 'idle' };
  evCharger: EVChargerStatus;
  timestamp: number;

  // Raw power values in Watts for internal calculations, always numbers (default 0)
  rawHomeConsumptionWatts: number;
  rawSolarPowerWatts: number;
  rawGridPowerWatts: number; // Negative for import, positive for export
  rawBatteryPowerWattsFromAPI: number; // Direct from API, negative for charge
  inferredRawBatteryPowerWatts?: number; // Calculated, negative for charge
  today?: DailyEnergyTotals; // Optional daily totals from meter-data
}

export interface GivEnergyIDs {
  inverterSerial: string | null;
  evChargerId?: string | null;
  batteryNominalCapacityKWh?: number | null; // Added for dynamic battery capacity
}

export type Theme = "light" | "dark" | "hc-light" | "hc-dark" | "system";

export interface AccountData {
  id: number;
  name: string;
  first_name: string | null;
  surname: string | null;
  role: string;
  email: string;
  address: string | null;
  postcode: string | null;
  country: string | null;
  telephone_number: string | null;
  timezone: string;
  standard_timezone: string;
  company: string | null;
}

export interface RawAccountResponse {
  data: AccountData;
}


// --- API Response Link and Meta structures for Paginated Responses ---
export interface GivEnergyAPILinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

export interface GivEnergyAPIMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  path: string;
  per_page: number;
  to: number | null;
  total: number;
}

// --- Generic Paginated API Response Type ---
export interface GivEnergyPaginatedResponse<T> {
  data: T[];
  links: GivEnergyAPILinks;
  meta: GivEnergyAPIMeta;
}

// --- Raw API Response Types (internal to givenergy.ts) ---

export interface GivEnergyAPIData<T> {
  data: T;
}

export interface RawCommunicationDevice {
  serial_number: string;
  type: string;
  commission_date?: string;
  inverter: {
    serial: string;
    status?: string;
    last_online?: string;
    last_updated?: string;
    commission_date?: string;
    info?: {
        battery_type: string;
        battery: {
            nominal_capacity: number; // Ah
            nominal_voltage: number; // V
            depth_of_discharge?: number;
        };
        model: string;
        max_charge_rate: number;
    };
    warranty?: {
        type: string;
        expiry_date: string;
    };
    firmware_version: {
        ARM: number | null;
        DSP: number | null;
    } | string;
    connections?: {
        batteries: any[];
        meters?: any[];
    };
    flags?: string[];
  };
}
export type RawCommunicationDevicesResponse = GivEnergyPaginatedResponse<RawCommunicationDevice>;


export interface RawEVCharger {
    uuid: string;
    serial_number: string;
    type: string;
    alias: string;
    online: boolean;
    went_offline_at: string | null;
    status: string; // This is often a basic status string like "CHARGING" or "AVAILABLE"
}
export type RawEVChargersResponse = GivEnergyPaginatedResponse<RawEVCharger>;


export interface RawSystemDataLatest {
  time: string;
  status: string; // Inverter status (e.g. "Normal")
  solar: { power: number; arrays: { array: number; voltage: number; current: number; power: number }[] };
  grid: { voltage: number; current: number; power: number; frequency: number };
  battery: { percent: number; power: number; temperature: number }; // battery.power: -ve for charge, +ve for discharge
  inverter: {
    temperature: number;
    power: number; // Total power output from inverter
    output_voltage: number;
    output_frequency: number;
    eps_power: number;
  };
  consumption: number; // Home consumption in Watts
}
export type RawSystemDataLatestResponse = GivEnergyAPIData<RawSystemDataLatest>;


export interface RawEVChargerStatus { // From /ev-charger/{uuid}/status
    mode: string; // e.g. "ECO", "BOOST"
    status: string; // More detailed OCPP status e.g. "Charging", "Available", "SuspendedEV"
    charge_session: {
        status: string; // e.g. "ACTIVE", "STOPPED"
        power: number | null; // Watts, can be null
        kwh_delivered: number;
        start_time: string | null;
        end_time: string | null;
    } | null;
    vehicle_connected: boolean;
}
export type RawEVChargerStatusResponse = GivEnergyAPIData<RawEVChargerStatus>;

// Type for /inverter/{serial}/meter-data/latest
export interface RawMeterDataLatest {
    time: string;
    today: {
        solar: number; // kWh
        grid: {
            import: number; // kWh
            export: number; // kWh
        };
        battery: {
            charge: number; // kWh
            discharge: number; // kWh
        };
        consumption: number; // kWh
        ac_charge: number; // kWh
    };
    total: { // Lifetime totals
        solar: number;
        grid: {
            import: number;
            export: number;
        };
        battery: {
            charge: number;
            discharge: number;
        };
        consumption: number;
        ac_charge: number;
    };
    is_metered: boolean;
}
export type RawMeterDataLatestResponse = GivEnergyAPIData<RawMeterDataLatest>;

// New type for historical energy data points
export interface HistoricalEnergyDataPoint {
  date: string; // YYYY-MM-DD
  solarGeneration: number; // kWh
  gridImport: number; // kWh
  gridExport: number; // kWh
  batteryCharge: number; // kWh
  batteryDischarge: number; // kWh
  consumption: number; // kWh
  solarToHome: number; // kWh
  solarToBattery: number; // kWh
  solarToGrid: number; // kWh
  batteryToHome: number; // kWh
  gridToHome: number; // kWh
}

// EV Charger Schedule types
export interface EVChargerAPIRule {
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
  days: string[];     // e.g., ["MONDAY", "TUESDAY", ...] for internal use
  limit?: number;     // Optional charge current limit in Amps
}

export interface RawDeviceApiPeriod {
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
  limit?: number;      // Amps
  phase_count?: number | null;
  duration?: string;   // e.g., "03h 00m"
  days: number[];     // Array of numbers [0, 1, ..., 6] for API interaction
}

export interface RawDeviceApiScheduleEntry {
  id?: number;
  name: string;
  is_active: boolean;
  periods: RawDeviceApiPeriod[];
}

export interface EVChargerDeviceScheduleListResponse {
  data: {
    schedules: RawDeviceApiScheduleEntry[];
  };
}

// For POSTing a schedule to the device
export interface EVChargerSetSchedulePayload {
  name: string;
  is_active: boolean;
  periods: RawDeviceApiPeriod[];
}


export interface EVChargerClearScheduleResponse {
    data: {
        success: boolean;
        message?: string;
    }
}

export interface NamedEVChargerSchedule {
  id: string; 
  name: string;
  rules: EVChargerAPIRule[];
  createdAt: string; 
  updatedAt: string; 
}
