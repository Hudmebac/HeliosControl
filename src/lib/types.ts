
export interface Metric {
  value: number | string;
  unit: string;
}

export interface BatteryStatus extends Metric {
  charging?: boolean; // true if charging, false if discharging, undefined if idle
  percentage: number;
}

export interface EVChargerStatus extends Metric {
  status: 'charging' | 'idle' | 'faulted' | 'disconnected';
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
  inverterCommDeviceUUID: string | null; // UUID of the communication device associated with the inverter
  evChargerId?: string | null;
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
  uuid: string;
  serial_number: string; 
  type: string; 
  inverter: {
    serial: string;
    firmware_version: string;
  };
}
// Updated to use paginated response type
export type RawCommunicationDevicesResponse = GivEnergyPaginatedResponse<RawCommunicationDevice>;


export interface RawEVCharger {
    id: string;
    alias: string;
    serial_number: string;
    type: string;
    status: string; 
}
// Updated to use paginated response type
export type RawEVChargersResponse = GivEnergyPaginatedResponse<RawEVCharger>;


export interface RawSystemDataLatest {
  time: string;
  solar: { power: number; arrays: { array: number; voltage: number; current: number; power: number }[] };
  grid: { power: number; current: number; voltage: number; frequency: number };
  battery: { percent: number; power: number; temperature: number };
  inverter: { power: number; temperature: number; status: string; eps_power: number };
  consumption: { power: number };
}
export type RawSystemDataLatestResponse = GivEnergyAPIData<RawSystemDataLatest>;


export interface RawEVChargerStatus {
    mode: string; 
    status: string; 
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
