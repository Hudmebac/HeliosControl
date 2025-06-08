
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
  evChargerId?: string | null; // This will be the UUID of the EV Charger
}

export type Theme = "light" | "dark" | "hc-light" | "hc-dark" | "system";

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
interface GivEnergyAPIData<T> {
  data: T;
}

export interface RawCommunicationDevice {
  // uuid field is not present in the "GET /communication-device" list example from new docs
  serial_number: string;
  type: string;
  commission_date?: string; // Optional as per some examples
  inverter: {
    serial: string;
    status?: string; // Optional as per some examples
    last_online?: string;
    last_updated?: string;
    commission_date?: string;
    info?: {
        battery_type: string;
        battery: {
            nominal_capacity: number;
            nominal_voltage: number;
            depth_of_discharge?: number; // Optional
        };
        model: string;
        max_charge_rate: number;
    };
    warranty?: {
        type: string;
        expiry_date: string;
    };
    firmware_version: { // Changed from string to object based on new docs
        ARM: number | null;
        DSP: number | null;
    } | string; // Allowing string for resilience if API is inconsistent or other endpoints are used
    connections?: { // Optional
        batteries: any[]; // Simplified for now
        meters?: any[]; // Simplified for now
    };
    flags?: string[];
  };
}
export type RawCommunicationDevicesResponse = GivEnergyPaginatedResponse<RawCommunicationDevice>;


export interface RawEVCharger {
    uuid: string; // Changed from id to uuid
    serial_number: string;
    type: string;
    alias: string;
    online: boolean;
    went_offline_at: string | null;
    status: string; // Raw status from API, will be mapped
}
export type RawEVChargersResponse = GivEnergyPaginatedResponse<RawEVCharger>;


export interface RawSystemDataLatest {
  time: string;
  status: string; // Top-level status added
  solar: { power: number; arrays: { array: number; voltage: number; current: number; power: number }[] };
  grid: { voltage: number; current: number; power: number; frequency: number };
  battery: { percent: number; power: number; temperature: number };
  inverter: {
    temperature: number;
    power: number;
    // status: string; // Removed from here as per example, now top-level
    output_voltage: number; // Added
    output_frequency: number; // Added
    eps_power: number;
  };
  consumption: number; // Changed from { power: number } to number
}
export type RawSystemDataLatestResponse = GivEnergyAPIData<RawSystemDataLatest>;


export interface RawEVChargerStatus {
    mode: string;
    status: string; // This is the raw string status from the API
    charge_session: {
        status: string;
        power: number; // Watts
        kwh_delivered: number;
        start_time: string | null;
        end_time: string | null;
    } | null;
    vehicle_connected: boolean;
}
export type RawEVChargerStatusResponse = GivEnergyAPIData<RawEVChargerStatus>;
