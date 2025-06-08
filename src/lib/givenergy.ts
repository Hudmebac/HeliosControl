
import type { RealTimeData, GivEnergyIDs, Metric, BatteryStatus, EVChargerStatus } from "@/lib/types";

// MOCK IMPLEMENTATION
// In a real scenario, these functions would make authenticated API calls to GivEnergy.

const MOCK_API_KEY_VALID = "VALID_KEY"; // Replace with a mock valid key for testing

export async function validateApiKey(apiKey: string): Promise<boolean> {
  // Simulate API call to validate key
  await new Promise(resolve => setTimeout(resolve, 500));
  // Basic mock validation - allows the MOCK_API_KEY_VALID or any non-empty string for broader testing.
  return apiKey === MOCK_API_KEY_VALID || (apiKey && apiKey.length > 0); 
}

export async function getDeviceIDs(apiKey: string): Promise<GivEnergyIDs> {
  if (!await validateApiKey(apiKey)) {
    throw new Error("Invalid API Key");
  }
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 700));
  return {
    inverterSerial: "INV123456789",
    inverterUUID: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    evChargerId: "EV001",
  };
}

let lastSolarGeneration = 2.5;
let lastHomeConsumption = 1.0;
let lastBatteryPercentage = 70;
let lastGridPower = 0.5; // Positive for import, negative for export

export async function getRealTimeData(apiKey: string): Promise<RealTimeData> {
  if (!await validateApiKey(apiKey)) {
    throw new Error("Invalid API Key");
  }
  // Simulate API call and dynamic data
  await new Promise(resolve => setTimeout(resolve, 300));

  // Simulate fluctuations
  lastSolarGeneration += (Math.random() - 0.5) * 0.2; // Fluctuate by +/- 0.1 kW
  if (lastSolarGeneration < 0) lastSolarGeneration = 0;
  if (lastSolarGeneration > 5) lastSolarGeneration = 5;

  lastHomeConsumption += (Math.random() - 0.5) * 0.1;
  if (lastHomeConsumption < 0.1) lastHomeConsumption = 0.1; // Min consumption
  if (lastHomeConsumption > 3) lastHomeConsumption = 3;


  const isCharging = Math.random() > 0.5;
  if (isCharging && lastBatteryPercentage < 100) {
    lastBatteryPercentage += Math.random() * 2;
    if (lastBatteryPercentage > 100) lastBatteryPercentage = 100;
  } else if (!isCharging && lastBatteryPercentage > 0) {
    lastBatteryPercentage -= Math.random() * 1;
    if (lastBatteryPercentage < 0) lastBatteryPercentage = 0;
  }
  
  lastGridPower += (Math.random() - 0.5) * 0.3;
  if (Math.abs(lastGridPower) < 0.05) lastGridPower = 0;


  const homeConsumption: Metric = { value: parseFloat(lastHomeConsumption.toFixed(2)), unit: "kW" };
  const solarGeneration: Metric = { value: parseFloat(lastSolarGeneration.toFixed(2)), unit: "kW" };
  const battery: BatteryStatus = {
    value: parseFloat(lastBatteryPercentage.toFixed(0)),
    unit: "%",
    percentage: parseFloat(lastBatteryPercentage.toFixed(0)),
    charging: lastBatteryPercentage < 98 ? (isCharging ? true : Math.random() > 0.7 ? false : undefined) : false,
  };
  const grid: Metric & { flow: 'importing' | 'exporting' | 'idle' } = {
    value: parseFloat(Math.abs(lastGridPower).toFixed(2)),
    unit: "kW",
    flow: lastGridPower > 0.05 ? 'importing' : lastGridPower < -0.05 ? 'exporting' : 'idle',
  };
  
  const evChargerStatuses: EVChargerStatus['status'][] = ['charging', 'idle', 'disconnected'];
  const currentEVStatus = evChargerStatuses[Math.floor(Math.random() * evChargerStatuses.length)];
  const evCharger: EVChargerStatus = {
    value: currentEVStatus === 'charging' ? parseFloat((Math.random() * 7).toFixed(1)) : 0,
    unit: "kW",
    status: currentEVStatus,
  };

  return {
    homeConsumption,
    solarGeneration,
    battery,
    grid,
    evCharger,
    timestamp: Date.now(),
  };
}
