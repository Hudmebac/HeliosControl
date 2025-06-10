
"use client"

import * as React from "react"; // Added this line
import { DashboardCard } from "./DashboardCard";
import { EnergyFlowVisual } from "./EnergyFlowVisual"; // Import the visual flow component
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, Bolt, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, PowerOff, Power, PlugZap, Loader2, Lightbulb, PackageOpen, Flame } from "lucide-react";
import type { BatteryStatus, Metric, RealTimeData, EVChargerStatus as EVChargerStatusType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card"; // Added import for Card and CardContent

interface DashboardGridProps {
  apiKey: string;
}

interface CardDetails {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  description?: React.ReactNode; // Changed to ReactNode to support JSX
  valueColorClassName?: string;
  className?: string;
}

function getBatteryIcon(battery: BatteryStatus, batteryPowerFlowWatts: number) {
  const isCharging = batteryPowerFlowWatts < -50; // More than 50W charging
  // const isDischarging = batteryPowerFlowWatts > 50; // More than 50W discharging

  if (isCharging) return <BatteryCharging className="h-6 w-6 text-blue-500" />; // Consistent blue for charging
  // For discharging or idle, icon based on percentage
  if (battery.percentage > 80) return <BatteryFull className="h-6 w-6 text-green-500" />;
  if (battery.percentage > 40) return <BatteryMedium className="h-6 w-6 text-yellow-500" />;
  if (battery.percentage > 10) return <BatteryLow className="h-6 w-6 text-orange-500" />;
  return <BatteryWarning className="h-6 w-6 text-red-600" />; // Critical or unknown while not charging
}

const formatPowerValue = (originalValue: number | string, originalUnit: string): { value: string | number; unit: string } => {
  if (typeof originalValue === 'number' && (originalUnit === "kW" || originalUnit === "W")) {
    const valueInWatts = originalUnit === "kW" ? originalValue * 1000 : originalValue;
    if (Math.abs(valueInWatts) < 1000) { // Prefer W if less than 1 kW
        return { value: Math.round(valueInWatts), unit: "W" };
    }
    // Otherwise, show in kW, formatted to 2 decimal places if not an integer
    const valueInKW = valueInWatts / 1000;
    return { value: Number.isInteger(valueInKW) ? valueInKW : parseFloat(valueInKW.toFixed(2)), unit: "kW" };
  }
  // Fallback for non-numeric or non-power values
  return { value: originalValue, unit: originalUnit };
};


// --- Card Detail Helper Functions ---
function getHomeConsumptionCardDetails(
    hcData: Metric,
    rawGridWatts: number,
    rawSolarWatts: number,
    effectiveBatteryPowerWatts: number,
    timestamp: number
): CardDetails {
    const formattedHC = formatPowerValue(hcData.value, hcData.unit);
    let color = "";
    const consumptionWatts = (typeof hcData.value === 'number' ? hcData.value : 0) * (hcData.unit === 'kW' ? 1000 : 1);
    const solarWatts = rawSolarWatts;
    const batteryDischargeWatts = Math.max(0, effectiveBatteryPowerWatts); // Positive if discharging
    const gridImportWatts = Math.max(0, -rawGridWatts); // Positive if importing

    const epsilon = 10; // 10W threshold

    if (consumptionWatts <= epsilon) { // Very low consumption
        if (solarWatts > epsilon) color = "text-green-600"; // Solar active, low consumption
        else if (batteryDischargeWatts > epsilon) color = "text-orange-500"; // Battery covering tiny load
        // If grid is exporting, it's likely due to solar/battery, so color is less critical for HC
    } else { // Significant consumption
        if (gridImportWatts > epsilon) color = "text-red-600"; // Grid import is primary source for home
        else if (solarWatts >= consumptionWatts - epsilon) color = "text-green-600"; // Primarily solar
        else if (solarWatts + batteryDischargeWatts >= consumptionWatts - epsilon) {
             color = solarWatts > epsilon ? "text-orange-500" : "text-orange-600"; // Solar + Battery (Orange if solar contributes, Darker Orange if mostly battery)
        } else {
            // This case implies something is not adding up or there's a very small uncaptured flow
            // Or it's all battery if solar is negligible
            color = batteryDischargeWatts > epsilon ? "text-orange-600" : ""; // Fallback, or mainly battery
        }
    }
    return { title: "Home Consumption", ...formattedHC, icon: <Home className="h-6 w-6" />, description: `Updated: ${new Date(timestamp).toLocaleTimeString()}`, valueColorClassName: color, className: "min-h-[120px]" };
}

function getSolarGenerationCardDetails(
    solarData: Metric,
    dailySolarTotalKW: number | undefined,
    timestamp: number
): CardDetails {
    const formattedSolar = formatPowerValue(solarData.value, solarData.unit);
    let color = "text-muted-foreground"; // Default/low power
    const solarPowerW = (typeof solarData.value === 'number' ? solarData.value : 0) * (solarData.unit === 'kW' ? 1000 : 1);

    if (solarPowerW >= 3500) color = "text-orange-500"; // High generation
    else if (solarPowerW >= 1000) color = "text-green-600"; // Medium generation
    else if (solarPowerW > 50) color = "text-yellow-500"; // Low but active generation

    let description = `Updated: ${new Date(timestamp).toLocaleTimeString()}`;
    if (typeof dailySolarTotalKW === 'number') {
        description = `Today: ${dailySolarTotalKW.toFixed(1)} kWh / ${description}`;
    }
    return { title: "Solar Generation", ...formattedSolar, icon: <Sun className="h-6 w-6" />, valueColorClassName: color, description, className: "min-h-[120px]" };
}

function getBatteryCardDetails(
    batteryInfo: BatteryStatus, // Contains percentage and direct API power (if needed for other things)
    currentBatteryPowerWatts: number, // This is the *effective* flow (API or inferred)
    rawGridPowerWattsFromSystem: number,
    rawSolarPowerWattsFromSystem: number,
    homeConsumptionActualValue: number | string,
    timestamp: number
): CardDetails {
    const isCharging = currentBatteryPowerWatts < -50; // Effective power is negative for charging
    const isDischarging = currentBatteryPowerWatts > 50; // Effective power is positive for discharging
    let statusDescription: React.ReactNode = "Idle"; // Changed to ReactNode
    let valueColor = "text-muted-foreground";

    const homeNeedsPower = (typeof homeConsumptionActualValue === 'number' && homeConsumptionActualValue > 0.05); // Home consumption > 50W (0.05kW)

    if (isCharging) {
        valueColor = "text-blue-500"; // General charging
        const chargingPowerKW = Math.abs(currentBatteryPowerWatts) / 1000;
        statusDescription = `Charging at ${chargingPowerKW.toFixed(2)} kW`;

        const isGridImportingForBattery = rawGridPowerWattsFromSystem < -50;
        const isSolarGeneratingForBattery = rawSolarPowerWattsFromSystem > 50;

        if (isGridImportingForBattery && (!isSolarGeneratingForBattery || Math.abs(rawGridPowerWattsFromSystem) > rawSolarPowerWattsFromSystem * 0.8)) { // Grid is primary charger
            statusDescription = <span className="text-orange-500">Charging from Grid at {chargingPowerKW.toFixed(2)} kW</span>;
            valueColor = "text-orange-500";
        } else if (isSolarGeneratingForBattery) {
            statusDescription = <span className="text-green-600">Charging from Solar at {chargingPowerKW.toFixed(2)} kW</span>;
            valueColor = "text-green-600";
        }
    } else if (isDischarging) {
        valueColor = "text-orange-600"; // General discharging
        const dischargingPowerKW = currentBatteryPowerWatts / 1000;
        statusDescription = `Discharging at ${dischargingPowerKW.toFixed(2)} kW`;
        if (homeNeedsPower) {
           statusDescription = <span className="text-orange-600">Supplying Home at {dischargingPowerKW.toFixed(2)} kW</span>;
        }
    } else { // Idle or very low flow
      if (batteryInfo.percentage >= 99) statusDescription = "Full";
      else if (batteryInfo.percentage <=15) statusDescription = "Low Charge";
    }

    const chargeLevelString = `${batteryInfo.percentage}%`;
    return { title: "Battery Status", value: chargeLevelString, unit: "", icon: getBatteryIcon(batteryInfo, currentBatteryPowerWatts), description: statusDescription, valueColorClassName: valueColor, className: "min-h-[120px]" };
}

function getGridCardDetails(
    gridData: Metric & { flow: 'importing' | 'exporting' | 'idle' },
    dailyGridImportKW: number | undefined,
    dailyGridExportKW: number | undefined,
    timestamp: number
): CardDetails {
    const formattedGrid = formatPowerValue(gridData.value, gridData.unit);
    let color = "text-muted-foreground"; // Idle
    if (gridData.flow === 'importing') color = "text-red-600";
    else if (gridData.flow === 'exporting') color = "text-blue-500";

    let description = `${gridData.flow.charAt(0).toUpperCase() + gridData.flow.slice(1)}`;
    if (typeof dailyGridImportKW === 'number' && typeof dailyGridExportKW === 'number') {
        description = `I: ${dailyGridImportKW.toFixed(1)} kWh / E: ${dailyGridExportKW.toFixed(1)} kWh`;
    }
     description += ` / ${new Date(timestamp).toLocaleTimeString()}`;

    return { title: "Grid Status", ...formattedGrid, icon: <Power className="h-6 w-6" />, description, valueColorClassName: color, className: "min-h-[120px]" };
}

function getEVChargerCardDetails(
    evData: EVChargerStatusType, // Use the more specific type from lib/types
    timestamp: number
): CardDetails {
    const formattedEV = formatPowerValue(evData.value, evData.unit);
    let color = "text-muted-foreground";
    let icon = <PlugZap className="h-6 w-6" />; // Default

    // Ensure evData.status is a string before using .includes() or other string methods
    const statusString = React.isValidElement(evData.status) ? "JSX_Element" : String(evData.status || "unknown").toLowerCase();


    if (statusString.includes("charging")) { // More robust check
        color = "text-green-500";
        icon = <Bolt className="h-6 w-6 text-green-500" />;
    } else if (statusString.includes("faulted") || statusString.includes("unavailable")) {
        color = "text-red-500";
        icon = <AlertTriangle className="h-6 w-6 text-red-500" />;
    } else if (statusString.includes("idle") || statusString.includes("preparing") || statusString.includes("plugged") || statusString.includes("ready")) {
        color = "text-blue-500"; // Plugged in, ready or preparing
    }
    // 'disconnected' uses default color and icon

    let description: React.ReactNode = `Status: ${statusString}`;
    if (React.isValidElement(evData.status)) { // If it's already a ReactNode (JSX)
        description = evData.status; // Use the JSX directly
    }


    return { title: "EV Charger", ...formattedEV, icon, description, valueColorClassName: color, className: "min-h-[120px]" };
}


export function DashboardGrid({ apiKey }: DashboardGridProps) {
  const { data, isLoading, error, refetch } = useGivEnergyData(apiKey);

  if (error && !data) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Fetching Data</h3>
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">{error}</p>
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }
  
  if (isLoading && !data) {
    // Skeleton for the new layout
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4 flex flex-col">
          <Card className="shadow-lg h-full min-h-[300px] md:min-h-[400px]"><CardContent className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/></CardContent></Card>
          <DashboardCard title="" value="" icon={<PlugZap className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
        </div>
        <div className="md:col-span-1 space-y-4 flex flex-col">
          {Array(4).fill(0).map((_, index) => (
            <DashboardCard key={`skeleton-small-${index}`} title="" value="" icon={<Lightbulb className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Waiting for data...</p>
      </div>
    );
  }

  const homeDetails = getHomeConsumptionCardDetails(data.homeConsumption, data.rawGridPowerWatts, data.rawSolarPowerWatts, data.battery.rawPowerWatts, data.timestamp);
  const solarDetails = getSolarGenerationCardDetails(data.solarGeneration, data.today?.solar?.energy?.total, data.timestamp);
  // For battery card, use data.battery.rawPowerWatts which is the effective (API or inferred) power
  const batteryDetails = getBatteryCardDetails(data.battery, data.battery.rawPowerWatts, data.rawGridPowerWatts, data.rawSolarPowerWatts, data.homeConsumption.value, data.timestamp);
  const gridDetails = getGridCardDetails(data.grid, data.today?.grid?.energy?.import_total, data.today?.grid?.energy?.export_total, data.timestamp);
  const evDetails = getEVChargerCardDetails(data.evCharger, data.timestamp);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Left Column */}
      <div className="md:col-span-2 space-y-4 flex flex-col">
        {data && <EnergyFlowVisual data={data} />}
        {evDetails && (
          <DashboardCard
            key={evDetails.title}
            title={evDetails.title}
            value={evDetails.value}
            unit={evDetails.unit}
            icon={evDetails.icon}
            description={evDetails.description}
            isLoading={false} // Data is loaded if we reach here
            valueColorClassName={evDetails.valueColorClassName}
            className={cn(evDetails.className, "flex-grow-0 flex-shrink-0")} // Prevent this card from shrinking too much
          />
        )}
      </div>

      {/* Right Column */}
      <div className="md:col-span-1 space-y-4 flex flex-col">
        {homeDetails && (
          <DashboardCard
            key={homeDetails.title}
            title={homeDetails.title}
            value={homeDetails.value}
            unit={homeDetails.unit}
            icon={homeDetails.icon}
            description={homeDetails.description}
            isLoading={false}
            valueColorClassName={homeDetails.valueColorClassName}
            className={cn(homeDetails.className, "flex-grow-0 flex-shrink-0")}
          />
        )}
        {solarDetails && (
          <DashboardCard
            key={solarDetails.title}
            title={solarDetails.title}
            value={solarDetails.value}
            unit={solarDetails.unit}
            icon={solarDetails.icon}
            description={solarDetails.description}
            isLoading={false}
            valueColorClassName={solarDetails.valueColorClassName}
            className={cn(solarDetails.className, "flex-grow-0 flex-shrink-0")}
          />
        )}
        {batteryDetails && (
          <DashboardCard
            key={batteryDetails.title}
            title={batteryDetails.title}
            value={batteryDetails.value}
            unit={batteryDetails.unit}
            icon={batteryDetails.icon}
            description={batteryDetails.description}
            isLoading={false}
            valueColorClassName={batteryDetails.valueColorClassName}
            className={cn(batteryDetails.className, "flex-grow-0 flex-shrink-0")}
          />
        )}
        {gridDetails && (
          <DashboardCard
            key={gridDetails.title}
            title={gridDetails.title}
            value={gridDetails.value}
            unit={gridDetails.unit}
            icon={gridDetails.icon}
            description={gridDetails.description}
            isLoading={false}
            valueColorClassName={gridDetails.valueColorClassName}
            className={cn(gridDetails.className, "flex-grow-0 flex-shrink-0")}
          />
        )}
      </div>
    </div>
  );
}

