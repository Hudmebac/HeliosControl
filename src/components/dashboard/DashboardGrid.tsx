
"use client"

import * as React from "react"; 
import { DashboardCard } from "./DashboardCard";
import { EnergyFlowVisual } from "./EnergyFlowVisual"; 
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, Bolt, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, PowerOff, Power, PlugZap, Loader2, Lightbulb, PackageOpen, Flame } from "lucide-react";
import type { BatteryStatus, Metric, RealTimeData, EVChargerStatus as EVChargerStatusType } from "@/lib/types";
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

function getBatteryIcon(battery: BatteryStatus, batteryPowerFlowWatts: number) {
  const isCharging = batteryPowerFlowWatts < -50; 

  if (isCharging) return <BatteryCharging className="h-6 w-6 text-blue-500" />; 
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
    rawGridWatts: number, // Negative for import, positive for export
    rawSolarWatts: number,
    effectiveBatteryPowerWatts: number, // Positive for discharge, negative for charge
    timestamp: number
): CardDetails {
    const formattedHC = formatPowerValue(hcData.value, hcData.unit);
    let color = "";
    const consumptionWatts = (typeof hcData.value === 'number' ? (hcData.unit === 'kW' ? hcData.value * 1000 : hcData.value) : 0);
    const solarWatts = Math.max(0, rawSolarWatts); // Ensure positive
    const batteryDischargeWatts = Math.max(0, effectiveBatteryPowerWatts); 
    const gridImportWatts = Math.max(0, -rawGridWatts); 

    const epsilon = 10; // 10W threshold

    if (consumptionWatts <= epsilon) { 
        if (solarWatts > epsilon) color = "text-green-500"; 
        else if (batteryDischargeWatts > epsilon) color = "text-orange-500"; 
        else color = "text-muted-foreground";
    } else { 
        if (gridImportWatts > consumptionWatts * 0.5 && gridImportWatts > epsilon) { // Primarily Grid
             color = "text-red-600";
        } else if (solarWatts >= consumptionWatts - epsilon) { // Primarily Solar
             color = "text-green-500";
        } else if (solarWatts + batteryDischargeWatts >= consumptionWatts - epsilon) { // Mix of Solar + Battery
             color = solarWatts > epsilon ? "text-yellow-500" : "text-orange-500"; 
        } else if (batteryDischargeWatts > epsilon) { // Primarily Battery
             color = "text-orange-500";
        } else { // If grid is covering the rest but wasn't primary (e.g. small grid share)
             color = gridImportWatts > epsilon ? "text-red-500" : "text-muted-foreground"; 
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

    if (solarPowerW >= 3000) color = "text-orange-500"; 
    else if (solarPowerW >= 1000) color = "text-green-500"; 
    else if (solarPowerW > 50) color = "text-yellow-500"; 

    let description = `Updated: ${new Date(timestamp).toLocaleTimeString()}`;
    if (typeof dailySolarTotalKW === 'number') {
        description = `Today: ${dailySolarTotalKW.toFixed(1)} kWh / ${description}`;
    }
    return { title: "Solar Generation", ...formattedSolar, icon: <Sun className="h-6 w-6" />, valueColorClassName: color, description, className: "min-h-[120px]" };
}

function getBatteryCardDetails(
    batteryInfo: BatteryStatus, 
    currentBatteryPowerWatts: number, // Effective flow (API or inferred), -ve for charge, +ve for discharge
    rawGridPowerWattsFromSystem: number, // -ve for import, +ve for export
    rawSolarPowerWattsFromSystem: number, // Always +ve
    homeConsumptionActualWatts: number, // Already in Watts
    timestamp: number
): CardDetails {
    const isCharging = currentBatteryPowerWatts < -50; 
    const isDischarging = currentBatteryPowerWatts > 50; 
    let statusDescription: React.ReactNode = "Idle"; 
    let valueColor = "text-muted-foreground"; // Color for the percentage text

    const absBatteryPowerKW = Math.abs(currentBatteryPowerWatts) / 1000;

    if (isCharging) {
        const isGridImportingForBattery = rawGridPowerWattsFromSystem < -50; // Grid is importing significantly
        const isSolarGeneratingForBattery = rawSolarPowerWattsFromSystem > 50; // Solar is generating significantly
        
        // Charging primarily from solar
        if (isSolarGeneratingForBattery && (!isGridImportingForBattery || rawSolarPowerWattsFromSystem > Math.abs(rawGridPowerWattsFromSystem) * 0.8 || Math.abs(currentBatteryPowerWatts) <= rawSolarPowerWattsFromSystem - homeConsumptionActualWatts + 50 )) {
            statusDescription = <span className="text-green-500">Charging from Solar at {absBatteryPowerKW.toFixed(2)} kW</span>;
            valueColor = "text-green-500";
        } 
        // Charging primarily from grid
        else if (isGridImportingForBattery) {
            statusDescription = <span className="text-orange-500">Charging from Grid at {absBatteryPowerKW.toFixed(2)} kW</span>;
            valueColor = "text-orange-500";
        } 
        // Generic charging if sources are mixed or unclear
        else {
            statusDescription = <span className="text-blue-500">Charging at {absBatteryPowerKW.toFixed(2)} kW</span>;
            valueColor = "text-blue-500";
        }
    } else if (isDischarging) {
        valueColor = "text-orange-500"; 
        // Check if discharging to home or grid (this logic might be complex if both happen)
        // For simplicity, assume primary discharge target is home if home has demand.
        if (homeConsumptionActualWatts > 50) {
            statusDescription = <span className="text-orange-500">Supplying Home at {absBatteryPowerKW.toFixed(2)} kW</span>;
        } else if (rawGridPowerWattsFromSystem > 50) { // Discharging to grid (exporting)
             statusDescription = <span className="text-blue-400">Exporting to Grid at {absBatteryPowerKW.toFixed(2)} kW</span>;
             valueColor = "text-blue-400";
        } else {
            statusDescription = `Discharging at ${absBatteryPowerKW.toFixed(2)} kW`;
        }
    } else { // Idle or very low flow
      if (batteryInfo.percentage >= 99) {
        statusDescription = "Full";
        valueColor = "text-green-500";
      } else if (batteryInfo.percentage >= 70) {
        statusDescription = "Good";
        valueColor = "text-green-400";
      } else if (batteryInfo.percentage >= 40) {
        statusDescription = "Medium";
        valueColor = "text-yellow-500";
      } else if (batteryInfo.percentage > 15) {
        statusDescription = "Low";
        valueColor = "text-orange-500";
      } else {
        statusDescription = "Nearly Empty";
        valueColor = "text-red-600";
      }
    }
    
    statusDescription = <>{statusDescription} <span className="text-xs text-muted-foreground">({new Date(timestamp).toLocaleTimeString()})</span></>;

    const chargeLevelString = `${batteryInfo.percentage}%`;
    return { title: "Battery Status", value: chargeLevelString, unit: "", icon: getBatteryIcon(batteryInfo, currentBatteryPowerWatts), description: statusDescription, valueColorClassName: valueColor, className: "min-h-[120px]" };
}

function getGridCardDetails(
    gridData: Metric & { flow: 'importing' | 'exporting' | 'idle' },
    dailyGridImportKWh: number | undefined, // Corrected prop name
    dailyGridExportKWh: number | undefined, // Corrected prop name
    timestamp: number
): CardDetails {
    const formattedGrid = formatPowerValue(gridData.value, gridData.unit);
    let color = "text-muted-foreground"; 
    let flowDescription = gridData.flow.charAt(0).toUpperCase() + gridData.flow.slice(1);

    if (gridData.flow === 'importing') {
        color = "text-red-600";
    } else if (gridData.flow === 'exporting') {
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
    timestamp: number
): CardDetails {
    const formattedEV = formatPowerValue(evData.value, evData.unit);
    let valueColor = "text-muted-foreground";
    let icon = <PlugZap className="h-6 w-6" />; 

    const statusString = React.isValidElement(evData.status) ? "" : String(evData.status || "unknown").toLowerCase();

    if (statusString.includes("charging")) { 
        valueColor = "text-green-500";
        icon = <Bolt className="h-6 w-6 text-green-500" />;
    } else if (statusString.includes("faulted") || statusString.includes("unavailable")) {
        valueColor = "text-red-500";
        icon = <AlertTriangle className="h-6 w-6 text-red-500" />;
    } else if (statusString.includes("idle") || statusString.includes("preparing") || statusString.includes("plugged") || statusString.includes("ready") || statusString.includes("suspended") || statusString.includes("finishing")) {
        valueColor = "text-blue-500"; // Plugged in, ready or preparing, or temporarily paused
    } else if (statusString.includes("disconnected") || statusString.includes("available")) {
         valueColor = "text-gray-400"; // Truly disconnected
    }


    let descriptionNode: React.ReactNode = evData.status; // evData.status is already a ReactNode from mapEVChargerAPIStatus
    
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
  
  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4 flex flex-col">
          <Card className="shadow-lg h-full min-h-[300px] md:min-h-[400px]"><CardContent className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary"/></CardContent></Card>
          <DashboardCard title="EV Charger" value="0" unit="kW" icon={<PlugZap className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
        </div>
        <div className="md:col-span-1 space-y-4 flex flex-col">
          <DashboardCard title="Home Consumption" value="0" unit="kW" icon={<Home className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
          <DashboardCard title="Solar Generation" value="0" unit="kW" icon={<Sun className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
          <DashboardCard title="Battery Status" value="0" unit="%" icon={<BatteryWarning className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
          <DashboardCard title="Grid Status" value="0" unit="kW" icon={<Power className="h-6 w-6"/>} isLoading={true} className="min-h-[120px]" />
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

  const homeWatts = (typeof data.homeConsumption.value === 'number' ? (data.homeConsumption.unit === 'kW' ? data.homeConsumption.value * 1000 : data.homeConsumption.value) : 0);

  const homeDetails = getHomeConsumptionCardDetails(data.homeConsumption, data.rawGridPowerWatts, data.rawSolarPowerWatts, data.battery.rawPowerWatts, data.timestamp);
  const solarDetails = getSolarGenerationCardDetails(data.solarGeneration, data.today?.solar, data.timestamp);
  const batteryDetails = getBatteryCardDetails(data.battery, data.battery.rawPowerWatts, data.rawGridPowerWatts, data.rawSolarPowerWatts, homeWatts, data.timestamp);
  const gridDetails = getGridCardDetails(data.grid, data.today?.gridImport, data.today?.gridExport, data.timestamp);
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
            isLoading={false} 
            valueColorClassName={evDetails.valueColorClassName}
            className={cn(evDetails.className, "flex-grow-0 flex-shrink-0")} 
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

