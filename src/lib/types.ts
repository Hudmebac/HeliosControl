
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
  inverterSerial: string;
  inverterUUID: string;
  evChargerId?: string;
}

export type Theme = "light" | "dark" | "hc-light" | "hc-dark" | "system";
