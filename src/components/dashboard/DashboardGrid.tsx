
"use client";

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
    rawGridWatts: number,
    rawSolarWatts: number,
    effectiveBatteryPowerWatts: number,
    dailyTotalConsumptionKWh: number | undefined,
    dailyGridImportKWh: number | undefined,
    timestamp: number
): CardDetails {
    const formattedHC = formatPowerValue(hcData.value, hcData.unit);
    let color = "";
    const consumptionWatts = (typeof hcData.value === 'number' ? (hcData.unit === 'kW' ? hcData.value * 1000 : hcData.value) : 0);
    const solarWatts = Math.max(0, rawSolarWatts);
    const batteryDischargeWatts = Math.max(0, effectiveBatteryPowerWatts);
    const gridImportWatts = Math.max(0, -rawGridWatts);

    const epsilon = POWER_FLOW_THRESHOLD_WATTS;

    if (consumptionWatts <= epsilon) {
        if (solarWatts > epsilon) color = "text-green-500";
        else if (batteryDischargeWatts > epsilon) color = "text-orange-500";
        else color = "text-muted-foreground";
    } else {
        if (gridImportWatts > consumptionWatts * 0.5 && gridImportWatts > epsilon) {
             color = "text-red-600";
        } else if (solarWatts >= consumptionWatts - epsilon) {
             color = "text-green-500";
        } else if (solarWatts + batteryDischargeWatts >= consumptionWatts - epsilon) {
             color = solarWatts > epsilon ? "text-yellow-500" : "text-orange-500";
        } else if (batteryDischargeWatts > epsilon) {
             color = "text-orange-500";
        } else {
             color = gridImportWatts > epsilon ? "text-red-500" : "text-muted-foreground";
        }
    }

    const timeString = `Updated: ${new Date(timestamp).toLocaleTimeString()}`;
    let dailyConsumptionString = "";
    if (typeof dailyTotalConsumptionKWh === 'number' && !isNaN(dailyTotalConsumptionKWh)) {
        dailyConsumptionString = `Today's Consumption: ${dailyTotalConsumptionKWh.toFixed(1)} kWh`;
    }
    let dailyGridImportString = "";
     if (typeof dailyGridImportKWh === 'number' && !isNaN(dailyGridImportKWh)) {
        dailyGridImportString = `Grid Import: ${dailyGridImportKWh.toFixed(1)} kWh`;
    }

    const descriptionElements: React.ReactNode[] = [];
    if (dailyConsumptionString) descriptionElements.push(<span key="totalConsumption">{dailyConsumptionString}</span>);
    if (dailyGridImportString) descriptionElements.push(<span key="gridImport">{dailyGridImportString}</span>);
    descriptionElements.push(<span key="time" className="text-xs text-muted-foreground">{timeString}</span>);


    const description = (
      <div className="space-y-0.5">
        {descriptionElements.map((el, index) => (
          <React.Fragment key={index}>
            {el}
            {index < descriptionElements.length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    );


    return { title: "Home Consumption", ...formattedHC, icon: <Home className="h-6 w-6" />, description, valueColorClassName: color, className: "min-h-[120px]" };
}

function getSolarGenerationCardDetails(
    solarData: Metric,
    dailySolarTotalKWh: number | undefined,
    timestamp: number
): CardDetails {
    const formattedSolar = formatPowerValue(solarData.value, solarData.unit);
    let color = "text-muted-foreground";
    const solarPowerW = (typeof solarData.value === 'number' ? (solarData.unit === 'kW' ? solarData.value * 1000 : solarData.value) : 0);

    if (solarPowerW >= 3000) color = "text-orange-500";
    else if (solarPowerW >= 1000) color = "text-green-500";
    else if (solarPowerW > POWER_FLOW_THRESHOLD_WATTS) color = "text-yellow-500";

    const timeString = `Updated: ${new Date(timestamp).toLocaleTimeString()}`;
    let dailyTotalString = "Today: N/A";
    if (typeof dailySolarTotalKWh === 'number' && !isNaN(dailySolarTotalKWh)) {
        dailyTotalString = `Today: ${dailySolarTotalKWh.toFixed(2)} kWh`;
    }

    const description = `${dailyTotalString} / ${timeString}`;

    return {
        title: "Solar Generation",
        ...formattedSolar,
        icon: <Sun className="h-6 w-6" />,
        valueColorClassName: color,
        description,
        className: "min-h-[120px]"
    };
}

function getBatteryCardDetails(
    batteryInfo: BatteryStatus,
    currentBatteryPowerWatts: number,
    rawGridPowerWattsFromSystem: number,
    rawSolarPowerWattsFromSystem: number,
    timestamp: number
): CardDetails {
    const chargeLevelString = `${batteryInfo.percentage}%`;
    let activityDescription = "";
    let valueColorClassName = "text-muted-foreground";

    const absBatteryPowerKW = Math.abs(currentBatteryPowerWatts) / 1000;
    const powerRateString = `${absBatteryPowerKW.toFixed(2)} kW`;

    const isCharging = currentBatteryPowerWatts < -POWER_FLOW_THRESHOLD_WATTS;
    const isDischarging = currentBatteryPowerWatts > POWER_FLOW_THRESHOLD_WATTS;
    const isGridImporting = rawGridPowerWattsFromSystem < -POWER_FLOW_THRESHOLD_WATTS;
    const isSolarGenerating = rawSolarPowerWattsFromSystem > POWER_FLOW_THRESHOLD_WATTS;
    const isGridExporting = rawGridPowerWattsFromSystem > POWER_FLOW_THRESHOLD_WATTS;

    if (isCharging) {
        if (isGridImporting && (Math.abs(rawGridPowerWattsFromSystem) > rawSolarPowerWattsFromSystem * 0.5 || !isSolarGenerating)) {
            activityDescription = `- Charging from Grid at ${powerRateString}`;
            valueColorClassName = "text-red-600";
        } else if (isSolarGenerating) {
            activityDescription = `- Charging from Solar at ${powerRateString}`;
            valueColorClassName = "text-green-600";
        } else {
            activityDescription = `- Charging at ${powerRateString}`;
            valueColorClassName = "text-blue-500";
        }
    } else if (isDischarging) {
        if (isGridExporting) {
            activityDescription = `- Discharging at ${powerRateString} (Grid Exporting)`;
            valueColorClassName = "text-blue-600";
        } else {
            activityDescription = `- Supplying Home at ${powerRateString}`;
            valueColorClassName = "text-orange-500";
        }
    } else { // Idle or very low flow
        activityDescription = "- Idle";
        if (batteryInfo.percentage >= 99) valueColorClassName = "text-green-500";
        else if (batteryInfo.percentage >= 70) valueColorClassName = "text-green-400";
        else if (batteryInfo.percentage >= 40) valueColorClassName = "text-yellow-500";
        else if (batteryInfo.percentage > 15) valueColorClassName = "text-orange-500";
        else valueColorClassName = "text-red-600";
    }

    const kwhInfoString = (typeof batteryInfo.energyKWh === 'number' && typeof batteryInfo.capacityKWh === 'number' && batteryInfo.capacityKWh > 0)
        ? `Charge: ${batteryInfo.energyKWh.toFixed(2)} kWh / ${batteryInfo.capacityKWh.toFixed(2)} kWh`
        : ``;

    const finalDescriptionElements = [];
    if (kwhInfoString) {
      finalDescriptionElements.push(<span key="kwh">{kwhInfoString}</span>);
    }
    if (activityDescription) {
      finalDescriptionElements.push(<span key="activity" className="block sm:inline sm:ml-1">{activityDescription}</span>);
    }
    finalDescriptionElements.push(<span key="time" className="block text-xs text-muted-foreground sm:inline sm:ml-1">({new Date(timestamp).toLocaleTimeString()})</span>);

    const finalDescription = (
      <div>
        {finalDescriptionElements.map((el, index) => (
          <React.Fragment key={index}>
            {el}
            {index < finalDescriptionElements.length -1 && !el.key?.toString().includes("kwh") && finalDescriptionElements[index+1]?.key?.toString().includes("activity") ? "" : ""}
            {index < finalDescriptionElements.length -1 && (el.key?.toString().includes("kwh") || el.key?.toString().includes("activity")) && index !== finalDescriptionElements.length -2 && <br className="sm:hidden"/>}
          </React.Fragment>
        ))}
      </div>
    );


    return {
        title: "Battery Status",
        value: chargeLevelString,
        unit: "",
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
    timestamp: number
): CardDetails {
    const formattedEV = formatPowerValue(evData.value, evData.unit);
    let valueColor = "text-muted-foreground";
    let icon = <PlugZap className="h-6 w-6" />;

    const powerInWatts = typeof evData.value === 'number' ? (evData.unit === 'kW' ? evData.value * 1000 : evData.value) : 0;

    if (powerInWatts > POWER_FLOW_THRESHOLD_WATTS) {
        valueColor = "text-green-500";
        icon = <Bolt className="h-6 w-6 text-green-500" />;
    } else if (React.isValidElement(evData.status) && evData.status.props.className?.includes('text-red')) { // Heuristic for faulted
        valueColor = "text-red-600";
        icon = <AlertTriangle className="h-6 w-6 text-red-600" />;
    }
    else {
        valueColor = "text-blue-500";
        icon = <PlugZap className="h-6 w-6 text-blue-500" />;
    }

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

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4 flex flex-col">
          {/* Placeholder for EnergyFlowVisual skeleton */}
          <Card className="shadow-lg h-full min-h-[300px] md:min-h-[400px]">
            <CardContent className="p-6 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            </CardContent>
          </Card>
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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <PackageOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">No data available. Check API key and system status.</p>
      </div>
    );
  }


  const homeDetails = getHomeConsumptionCardDetails(
    data.homeConsumption, 
    data.rawGridPowerWatts, 
    data.rawSolarPowerWatts, 
    data.battery.rawPowerWatts, 
    data.today?.consumption,
    data.today?.gridImport,
    data.timestamp
  );
  const solarDetails = getSolarGenerationCardDetails(data.solarGeneration, data.today?.solar, data.timestamp);
  const batteryDetails = getBatteryCardDetails(data.battery, data.battery.rawPowerWatts, data.rawGridPowerWatts, data.rawSolarPowerWatts, data.timestamp);
  const gridDetails = getGridCardDetails(data.grid, data.today?.gridImport, data.today?.gridExport, data.timestamp);
  const evDetails = getEVChargerCardDetails(data.evCharger, data.timestamp);

  const standardCards: CardDetails[] = [homeDetails, solarDetails, batteryDetails, gridDetails].filter(Boolean) as CardDetails[];


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            isLoading={isLoading && !data}
            valueColorClassName={evDetails.valueColorClassName}
            className={cn(evDetails.className, "flex-grow-0 flex-shrink-0")}
          />
        )}
      </div>

      <div className="md:col-span-1 space-y-4 flex flex-col">
        {standardCards.map((cardProps) => (
          <DashboardCard
            key={cardProps.title}
            {...cardProps}
            isLoading={isLoading && !data}
            className={cn(cardProps.className, "flex-grow-0 flex-shrink-0")}
          />
        ))}
      </div>
    </div>
  );
}

