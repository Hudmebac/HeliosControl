
export interface Metric {
  value: number | string;
  unit: string;
}

export type EVChargerInternalStatus =
  | 'charging'
  | 'idle' // General term for connected but not charging and not faulted
  | 'faulted'
  | 'disconnected' // Equivalent to OCPP "Available" (i.e., not connected to EV)
  | 'unavailable' // OCPP "Unavailable"
  | 'preparing' // OCPP "Preparing"
  | 'suspended' // Covers OCPP "SuspendedEVSE" and "SuspendedEV"
  | 'finishing' // OCPP "Finishing"
  | 'reserved'; // OCPP "Reserved"


export interface BatteryStatus extends Metric {
  charging?: boolean; // true if charging, false if discharging, undefined if idle
  percentage: number;
}

export interface EVChargerStatus extends Metric {
  status: EVChargerInternalStatus;
}

export interface RealTimeData {
  homeConsumption: Metric;
  solarGeneration: Metric;
  battery: BatteryStatus;
  grid: Metric & { flow: 'importing' | 'exporting' | 'idle' };
  evCharger: EVChargerStatus;
  timestamp: number;
}

export interface GivEnergyIDs {
  inverterSerial: string | null;
  evChargerId?: string | null;
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

// For non-paginated single-object data responses
export interface GivEnergyAPIData<T> { // Corrected export
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
            nominal_capacity: number;
            nominal_voltage: number;
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
    status: string;
}
export type RawEVChargersResponse = GivEnergyPaginatedResponse<RawEVCharger>;


export interface RawSystemDataLatest {
  time: string;
  status: string;
  solar: { power: number; arrays: { array: number; voltage: number; current: number; power: number }[] };
  grid: { voltage: number; current: number; power: number; frequency: number };
  battery: { percent: number; power: number; temperature: number };
  inverter: {
    temperature: number;
    power: number;
    output_voltage: number;
    output_frequency: number;
    eps_power: number;
  };
  consumption: number;
}
export type RawSystemDataLatestResponse = GivEnergyAPIData<RawSystemDataLatest>;


export interface RawEVChargerStatus {
    mode: string;
    status: string;
    charge_session: {
        status: string;
        power: number | null; // Watts, can be null
        kwh_delivered: number;
        start_time: string | null;
        end_time: string | null;
    } | null;
    vehicle_connected: boolean;
}
export type RawEVChargerStatusResponse = GivEnergyAPIData<RawEVChargerStatus>;
