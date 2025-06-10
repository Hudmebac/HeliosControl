
"use client"

import * as React from "react";
import { DashboardCard } from "./DashboardCard";
import { EnergyFlowVisual } from "./EnergyFlowVisual";
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, Bolt, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, PowerOff, Power, PlugZap, Loader2, Lightbulb, PackageOpen, Flame } from "lucide-react";
import type { BatteryStatus, Metric, RealTimeData, EVChargerStatus as EVChargerStatusType, DailyEnergyTotals } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardGridProps {
  apiKey: string;
}

interface CardDetails {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  description?: React.ReactNode;
  valueColorClassName?: string;
  className?: string;
}

const POWER_FLOW_THRESHOLD_WATTS = 50; // 50W threshold

function getBatteryIcon(battery: BatteryStatus, batteryPowerFlowWatts: number) {
  const isCharging = batteryPowerFlowWatts < -POWER_FLOW_THRESHOLD_WATTS;

  if (isCharging) return <BatteryCharging className="h-6 w-6 text-blue-500" />; // Generic charging icon, color on card will specify source
  if (battery.percentage > 80) return <BatteryFull className="h-6 w-6 text-green-500" />;
  if (battery.percentage > 40) return <BatteryMedium className="h-6 w-6 text-yellow-500" />;
  if (battery.percentage > 10) return <BatteryLow className="h-6 w-6 text-orange-500" />;
  return <BatteryWarning className="h-6 w-6 text-red-600" />;
}

const formatPowerValue = (originalValue: number | string, originalUnit: string): { value: string | number; unit: string } => {
  if (typeof originalValue === 'number' && (originalUnit === "kW" || originalUnit === "W")) {
    const valueInWatts = originalUnit === "kW" ? originalValue * 1000 : originalValue;
    if (Math.abs(valueInWatts) < 1000) {
        return { value: Math.round(valueInWatts), unit: "W" };
    }
    const valueInKW = valueInWatts / 1000;
    return { value: Number.isInteger(valueInKW) ? valueInKW : parseFloat(valueInKW.toFixed(2)), unit: "kW" };
  }
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
    const consumptionWatts = (typeof hcData.value === 'number' ? (hcData.unit === 'kW' ? hcData.value * 1000 : hcData.value) : 0);
    const solarWatts = Math.max(0, rawSolarWatts); 
    const batteryDischargeWatts = Math.max(0, effectiveBatteryPowerWatts);
    const gridImportWatts = Math.max(0, -rawGridWatts);

    const epsilon = POWER_FLOW_THRESHOLD_WATTS; 

    if (consumptionWatts <= epsilon) { // Very low consumption
        if (solarWatts > epsilon) color = "text-green-500"; // Covered by solar (even if small)
        else if (batteryDischargeWatts > epsilon) color = "text-orange-500"; // Covered by battery
        else color = "text-muted-foreground"; // Truly idle or negligible
    } else { // Significant consumption
        if (gridImportWatts > consumptionWatts * 0.5 && gridImportWatts > epsilon) { // Primarily Grid
             color = "text-red-600";
        } else if (solarWatts >= consumptionWatts - epsilon) { // Primarily Solar
             color = "text-green-500";
        } else if (solarWatts + batteryDischargeWatts >= consumptionWatts - epsilon) { // Mix of Solar + Battery
             color = solarWatts > epsilon ? "text-yellow-500" : "text-orange-500"; // Yellow if solar contributes, else orange for battery
        } else if (batteryDischargeWatts > epsilon) { // Primarily Battery
             color = "text-orange-500";
        } else { // Fallback or complex state, check if grid is covering the rest
             color = gridImportWatts > epsilon ? "text-red-500" : "text-muted-foreground"; // Red if grid involved, else muted
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
    let color = "text-muted-foreground";
    const solarPowerW = (typeof solarData.value === 'number' ? (solarData.unit === 'kW' ? solarData.value * 1000 : solarData.value) : 0);

    if (solarPowerW >= 3000) color = "text-orange-500"; // High generation
    else if (solarPowerW >= 1000) color = "text-green-500"; // Medium generation
    else if (solarPowerW > POWER_FLOW_THRESHOLD_WATTS) color = "text-yellow-500"; // Low generation

    let description = `Updated: ${new Date(timestamp).toLocaleTimeString()}`;
    if (typeof dailySolarTotalKW === 'number') {
        description = `Today: ${dailySolarTotalKW.toFixed(1)} kWh / ${description}`;
    }
    return { title: "Solar Generation", ...formattedSolar, icon: <Sun className="h-6 w-6" />, valueColorClassName: color, description, className: "min-h-[120px]" };
}

function getBatteryCardDetails(
    batteryInfo: BatteryStatus,
    currentBatteryPowerWatts: number, // This is data.battery.rawPowerWatts (effective flow)
    rawGridPowerWattsFromSystem: number, // This is data.rawGridPowerWatts
    rawSolarPowerWattsFromSystem: number, // This is data.rawSolarPowerWatts
    timestamp: number
): CardDetails {
    const chargeLevelString = `${batteryInfo.percentage}%`; // Main value of the card
    let activityDescription = "";
    let valueColorClassName = "text-muted-foreground"; // Color for the percentage text

    const absBatteryPowerKW = Math.abs(currentBatteryPowerWatts) / 1000;
    const powerRateString = `${absBatteryPowerKW.toFixed(2)} kW`;

    const isCharging = currentBatteryPowerWatts < -POWER_FLOW_THRESHOLD_WATTS;
    const isDischarging = currentBatteryPowerWatts > POWER_FLOW_THRESHOLD_WATTS;

    if (isCharging) {
        const isGridImportingForBattery = rawGridPowerWattsFromSystem < -POWER_FLOW_THRESHOLD_WATTS;
        const isSolarGeneratingForBattery = rawSolarPowerWattsFromSystem > POWER_FLOW_THRESHOLD_WATTS;

        // Prefer grid if significant grid import, even if some solar is present (e.g. Octopus Go)
        if (isGridImportingForBattery && (Math.abs(rawGridPowerWattsFromSystem) > rawSolarPowerWattsFromSystem * 0.5 || !isSolarGeneratingForBattery)) {
            activityDescription = `- Charging from Grid at ${powerRateString}`;
            valueColorClassName = "text-red-600";
        } else if (isSolarGeneratingForBattery) {
            activityDescription = `- Charging from Solar at ${powerRateString}`;
            valueColorClassName = "text-green-600";
        } else { // Generic charging (e.g. small mixed source, or API reports charging but sources unclear)
            activityDescription = `- Charging at ${powerRateString}`;
            valueColorClassName = "text-blue-500"; // A neutral charging color
        }
    } else if (isDischarging) {
        const isGridExporting = rawGridPowerWattsFromSystem > POWER_FLOW_THRESHOLD_WATTS;
        if (isGridExporting) {
            activityDescription = `- Supplying Home / Exporting at ${powerRateString}`;
            valueColorClassName = "text-blue-600";
        } else {
            activityDescription = `- Supplying Home at ${powerRateString}`;
            valueColorClassName = "text-orange-500";
        }
    } else { // Idle or very low flow
        activityDescription = "- Idle";
        // Color based on charge percentage when idle
        if (batteryInfo.percentage >= 99) valueColorClassName = "text-green-500"; // Full
        else if (batteryInfo.percentage >= 70) valueColorClassName = "text-green-400"; // Good
        else if (batteryInfo.percentage >= 40) valueColorClassName = "text-yellow-500"; // Medium
        else if (batteryInfo.percentage > 15) valueColorClassName = "text-orange-500"; // Low
        else valueColorClassName = "text-red-600"; // Critical
    }
    
    const kwhInfo = (typeof batteryInfo.energyKWh === 'number' && typeof batteryInfo.capacityKWh === 'number' && batteryInfo.capacityKWh > 0)
        ? `Charge: ${batteryInfo.energyKWh.toFixed(2)} kWh / ${batteryInfo.capacityKWh.toFixed(2)} kWh`
        : `Charge: N/A`;

    const finalDescription = (
        <>
            <span>{kwhInfo}</span>
            {activityDescription && <span className="ml-1">{activityDescription}</span>}
            <span className="text-xs text-muted-foreground ml-1">({new Date(timestamp).toLocaleTimeString()})</span>
        </>
    );

    return {
        title: "Battery Status",
        value: chargeLevelString, // Percentage is the main value
        unit: "", // Unit is part of percentage string
        icon: getBatteryIcon(batteryInfo, currentBatteryPowerWatts),
        description: finalDescription,
        valueColorClassName: valueColorClassName,
        className: "min-h-[120px]"
    };
}


function getGridCardDetails(
    gridData: Metric & { flow: 'importing' | 'exporting' | 'idle' },
    dailyGridImportKWh: number | undefined,
    dailyGridExportKWh: number | undefined,
    timestamp: number
): CardDetails {
    const formattedGrid = formatPowerValue(gridData.value, gridData.unit);
    let color = "text-muted-foreground";
    let flowDescription = gridData.flow.charAt(0).toUpperCase() + gridData.flow.slice(1);

    if (gridData.flow === 'importing' && (typeof gridData.value === 'number' && gridData.value * (gridData.unit === 'kW' ? 1000 : 1) > POWER_FLOW_THRESHOLD_WATTS)) {
        color = "text-red-600";
    } else if (gridData.flow === 'exporting' && (typeof gridData.value === 'number' && gridData.value * (gridData.unit === 'kW' ? 1000 : 1) > POWER_FLOW_THRESHOLD_WATTS)) {
        color = "text-blue-500";
    }


    let dailyTotals = "";
    if (typeof dailyGridImportKWh === 'number' && typeof dailyGridExportKWh === 'number') {
        dailyTotals = `I: ${dailyGridImportKWh.toFixed(1)} kWh / E: ${dailyGridExportKWh.toFixed(1)} kWh`;
    } else if (typeof dailyGridImportKWh === 'number') {
        dailyTotals = `I: ${dailyGridImportKWh.toFixed(1)} kWh`;
    } else if (typeof dailyGridExportKWh === 'number') {
        dailyTotals = `E: ${dailyGridExportKWh.toFixed(1)} kWh`;
    }

    const fullDescription = `${flowDescription}${dailyTotals ? ` (${dailyTotals})` : ''} / ${new Date(timestamp).toLocaleTimeString()}`;

    return { title: "Grid Status", ...formattedGrid, icon: <Power className="h-6 w-6" />, description: fullDescription, valueColorClassName: color, className: "min-h-[120px]" };
}


function getEVChargerCardDetails(
    evData: EVChargerStatusType,
    timestamp: number // Added timestamp for consistency, though not directly used in description text yet
): CardDetails {
    const formattedEV = formatPowerValue(evData.value, evData.unit);
    let valueColor = "text-muted-foreground";
    let icon = <PlugZap className="h-6 w-6" />; // Default icon

    // evData.status is already a ReactNode from mapEVChargerAPIStatus
    // To infer color, we need to check the underlying string or a more structured status
    // For now, let's assume we can infer from the power value or a simplified status string if available.

    const powerInWatts = typeof evData.value === 'number' ? (evData.unit === 'kW' ? evData.value * 1000 : evData.value) : 0;

    if (powerInWatts > POWER_FLOW_THRESHOLD_WATTS) { // Charging
        valueColor = "text-green-500";
        icon = <Bolt className="h-6 w-6 text-green-500" />;
    } else {
        // If not actively charging, use a generic icon/color or try to infer from status if it were structured
        // For now, default to idle-like blue if status suggests connection without high power.
        // This part is tricky without a raw status string here.
        // The evData.status (ReactNode) makes it hard to check content.
        // Assuming `mapEVChargerAPIStatus` would have set icon/color for faults.
        // If we need more refined EV card logic, `mapEVChargerAPIStatus` might need to return a structured object.
        valueColor = "text-blue-500"; // General "active but not charging hard" color
        icon = <PlugZap className="h-6 w-6 text-blue-500" />;
    }
    
    // If evData.status is a ReactNode, it should handle its own coloring.
    // The valueColorClassName here is for the numerical power value.
    let descriptionNode: React.ReactNode = (
        <>
          {evData.status}
          <span className="text-xs text-muted-foreground ml-1">({new Date(timestamp).toLocaleTimeString()})</span>
        </>
    );


    return { title: "EV Charger", ...formattedEV, icon, description: descriptionNode, valueColorClassName: valueColor, className: "min-h-[120px]" };
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

  if (isLoading && !data) { // Handles initial loading before first data arrives
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4 flex flex-col">
           {/* Placeholder for EnergyFlowVisual */}
          <Card className="shadow-lg h-full min-h-[300px] md:min-h-[400px]"><CardContent className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/></CardContent></Card>
           {/* Placeholder for EV Charger Card */}
          <DashboardCard title="EV Charger" value="0" unit="kW" icon={<PlugZap className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
        </div>
        <div className="md:col-span-1 space-y-4 flex flex-col">
          {["Home Consumption", "Solar Generation", "Battery Status", "Grid Status"].map(title => (
            <DashboardCard key={title} title={title} value="0" unit={title === "Battery Status" ? "%" : "kW"} icon={<Home className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
          ))}
        </div>
      </div>
    );
  }
  
  if (!data) { // Handles cases where data is null post-loading (e.g. API key removed)
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <PackageOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">No data available. Check API key and system status.</p>
      </div>
    );
  }


  const homeDetails = getHomeConsumptionCardDetails(data.homeConsumption, data.rawGridPowerWatts, data.rawSolarPowerWatts, data.battery.rawPowerWatts, data.timestamp);
  const solarDetails = getSolarGenerationCardDetails(data.solarGeneration, data.today?.solar, data.timestamp);
  const batteryDetails = getBatteryCardDetails(data.battery, data.battery.rawPowerWatts, data.rawGridPowerWatts, data.rawSolarPowerWatts, data.timestamp);
  const gridDetails = getGridCardDetails(data.grid, data.today?.gridImport, data.today?.gridExport, data.timestamp);
  const evDetails = getEVChargerCardDetails(data.evCharger, data.timestamp);

  const standardCards: CardDetails[] = [homeDetails, solarDetails, batteryDetails, gridDetails].filter(Boolean) as CardDetails[];


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
            isLoading={isLoading && !data} // Show loading if data is being fetched for the first time
            valueColorClassName={evDetails.valueColorClassName}
            className={cn(evDetails.className, "flex-grow-0 flex-shrink-0")}
          />
        )}
      </div>

      {/* Right Column */}
      <div className="md:col-span-1 space-y-4 flex flex-col">
        {standardCards.map((cardProps) => (
          <DashboardCard
            key={cardProps.title}
            {...cardProps}
            isLoading={isLoading && !data} // Show loading if data is being fetched for the first time
            className={cn(cardProps.className, "flex-grow-0 flex-shrink-0")}
          />
        ))}
      </div>
    </div>
  );
}

