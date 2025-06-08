
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

// --- Raw API Response Types (internal to givenergy.ts) ---

interface GivEnergyAPIData<T> {
  data: T;
}

export interface RawCommunicationDevice {
  uuid: string; // This is the communication device UUID
  inverter: {
    serial: string;
    model: string;
    firmware_version: string;
  };
  dongle: {
    serial: string;
    firmware_version: string;
  };
}
export type RawCommunicationDevicesResponse = GivEnergyAPIData<RawCommunicationDevice[]>;


export interface RawEVCharger {
    id: string;
    alias: string;
    serial_number: string;
    type: string;
    status: string; // e.g., "ONLINE"
}
export type RawEVChargersResponse = GivEnergyAPIData<RawEVCharger[]>;


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
    mode: string; // e.g. "SMART"
    status: string; // e.g. "CHARGING_SCHEDULED", "CHARGING", "IDLE", "DISCONNECTED", "PAUSED", "FAULTED", "ERROR"
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
