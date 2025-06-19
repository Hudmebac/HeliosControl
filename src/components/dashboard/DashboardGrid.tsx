
"use client";
import { useState, useEffect } from "react";
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
  if (typeof originalValue !== 'number' || (originalUnit !== "kW" && originalUnit !== "W")) {
    // Return non-numeric values or values with unknown units as is
    return { value: originalValue, unit: originalUnit };
  }

  const valueInWatts = originalUnit === "kW" ? originalValue * 1000 : originalValue;

  if (Math.abs(valueInWatts) < 1000) {
    return { value: Math.round(valueInWatts), unit: "W" };
  } else {
    const valueInKW = valueInWatts / 1000;
    // Show integer if it's a whole number after conversion, otherwise 2 decimal places
    return { value: Number.isInteger(valueInKW) ? valueInKW : parseFloat(valueInKW.toFixed(2)), unit: "kW" };
  }
};


// --- Card Detail Helper Functions ---
function getHomeConsumptionCardDetails(
    hcData: Metric,
    rawGridWatts: number, // Negative for import, positive for export
    rawSolarWatts: number, // Always positive
    effectiveBatteryPowerWatts: number, // Positive for discharge, negative for charge
    dailyTotalConsumptionKWh: number | undefined,
    dailyGridImportKWh: number | undefined,
    timestamp: number
): CardDetails {
    const formattedHC = formatPowerValue(hcData.value, hcData.unit);
    let hcColor = "text-muted-foreground"; // Default color
    const consumptionWatts = (typeof hcData.value === 'number' ? (hcData.unit === 'kW' ? hcData.value * 1000 : hcData.value) : 0);

    const solarSourceWatts = Math.max(0, rawSolarWatts);
    const batterySourceWatts = Math.max(0, effectiveBatteryPowerWatts); // Only consider discharge as a source
    const gridImportSourceWatts = Math.max(0, -rawGridWatts); // Only consider import as a source

    const epsilon = POWER_FLOW_THRESHOLD_WATTS; // 50W

    if (consumptionWatts > 3500) {
        hcColor = "text-red-600";
    } else if (gridImportSourceWatts > epsilon) {
        hcColor = "text-red-500";
    } else if (consumptionWatts <= epsilon && solarSourceWatts > epsilon) { // Negligible consumption, solar is generating
        hcColor = "text-green-500";
    } else if (consumptionWatts <= epsilon && batterySourceWatts > epsilon && solarSourceWatts <= epsilon) { // Negligible consumption, battery supplying, no solar
        hcColor = "text-orange-700";
    } else if (solarSourceWatts >= (consumptionWatts - epsilon) && consumptionWatts > epsilon) { // Solar Only
        hcColor = "text-green-500";
    } else if (solarSourceWatts > epsilon && batterySourceWatts > epsilon && (solarSourceWatts + batterySourceWatts >= (consumptionWatts - epsilon)) && consumptionWatts > epsilon) { // Solar + Battery
        hcColor = "text-orange-500";
    } else if (batterySourceWatts >= (consumptionWatts - epsilon) && solarSourceWatts <= epsilon && consumptionWatts > epsilon) { // Battery Only
        hcColor = "text-orange-700";
    }

    const timeString = `Updated: ${new Date(timestamp).toLocaleTimeString()}`;
    const descriptionElements: React.ReactNode[] = [];

    if (typeof dailyTotalConsumptionKWh === 'number' && !isNaN(dailyTotalConsumptionKWh)) {
        descriptionElements.push(<span key="totalConsumption">{`Today's Consumption: ${dailyTotalConsumptionKWh.toFixed(1)} kWh`}</span>);
    }
     if (typeof dailyGridImportKWh === 'number' && !isNaN(dailyGridImportKWh)) {
        descriptionElements.push(<span key="gridImport">{`Grid Import: ${dailyGridImportKWh.toFixed(1)} kWh`}</span>);
    }
    descriptionElements.push(<span key="time" className="text-xs text-muted-foreground">{timeString}</span>);


    const descriptionNode = (
      <div className="space-y-0.5">
        {descriptionElements.map((el, index) => (
          <div key={index}>{el}</div>
        ))}
      </div>
    );

    return {
        title: "Home Consumption",
        ...formattedHC,
        icon: <Home className="h-6 w-6" />,
        description: descriptionNode,
        valueColorClassName: hcColor,
        className: "min-h-[120px]"
    };
}


function getSolarGenerationCardDetails(
    solarData: Metric, 
    dailyTotals: DailyEnergyTotals | undefined,
    timestamp: number
): CardDetails {
    const formattedSolarPower = formatPowerValue(solarData.value, solarData.unit);
    let color = "text-muted-foreground";
    const solarPowerW = (typeof solarData.value === 'number' ? (solarData.unit === 'kW' ? solarData.value * 1000 : solarData.value) : 0);

    if (solarPowerW >= 3000) color = "text-orange-500";
    else if (solarPowerW >= 1000) color = "text-green-500";
    else if (solarPowerW > POWER_FLOW_THRESHOLD_WATTS) color = "text-yellow-500";

    let solarTotalGeneratedKWh = 0;
    let solarUsedForHomeKWh = 0;
    let solarChargedToBatteryKWh = 0;
    let solarExportedToGridKWh = 0;

    if (dailyTotals) {
        solarTotalGeneratedKWh = dailyTotals.solar || 0;
        const consumptionKWh = dailyTotals.consumption || 0;
        const gridImportKWh = dailyTotals.gridImport || 0;
        const batteryDischargeKWh = dailyTotals.batteryDischarge || 0;
        const batteryChargeKWh = dailyTotals.batteryCharge || 0;

        const consumptionMetByNonGridNonBattery = Math.max(0, consumptionKWh - gridImportKWh - batteryDischargeKWh);
        solarUsedForHomeKWh = Math.min(solarTotalGeneratedKWh, consumptionMetByNonGridNonBattery);

        const solarRemainingAfterHomeUse = Math.max(0, solarTotalGeneratedKWh - solarUsedForHomeKWh);
        solarChargedToBatteryKWh = Math.min(solarRemainingAfterHomeUse, batteryChargeKWh);
        
        const solarRemainingAfterHomeAndBatteryContribution = Math.max(0, solarRemainingAfterHomeUse - solarChargedToBatteryKWh);
        solarExportedToGridKWh = solarRemainingAfterHomeAndBatteryContribution;
    }

    const descriptionParts: React.ReactNode[] = [];
    if (dailyTotals) {
        descriptionParts.push(<div key="s2h">{`Solar to Home: ${solarUsedForHomeKWh.toFixed(2)} kWh`}</div>);
        descriptionParts.push(<div key="s2b">{`Solar to Battery: ${solarChargedToBatteryKWh.toFixed(2)} kWh`}</div>);
        descriptionParts.push(<div key="s2g">{`Solar to Grid: ${solarExportedToGridKWh.toFixed(2)} kWh`}</div>);
        descriptionParts.push(<div key="stotal" className="font-medium pt-1 border-t border-border/50 mt-1">{`Today's Generation: ${solarTotalGeneratedKWh.toFixed(2)} kWh`}</div>);
    } else {
        descriptionParts.push(<div key="stotal-na" className="font-medium">{`Today's Generation: N/A`}</div>);
    }
    descriptionParts.push(<div key="time" className="text-xs text-muted-foreground">{`Updated: ${new Date(timestamp).toLocaleTimeString()}`}</div>);
    
    const descriptionNode = (
      <div className="space-y-0.5">
        {descriptionParts.map((el, index) => <div key={index}>{el}</div>)}
      </div>
    );

    return {
        title: "Solar Generation",
        ...formattedSolarPower,
        icon: <Sun className="h-6 w-6" />,
        valueColorClassName: color,
        description: descriptionNode,
        className: "min-h-[120px]"
    };
}

function getBatteryCardDetails(
    batteryInfo: BatteryStatus,
    currentBatteryPowerWatts: number, // This is data.battery.rawPowerWatts (effective flow)
    rawGridPowerWattsFromSystem: number, // Negative for import
    rawSolarPowerWattsFromSystem: number, // Always positive
    dailyTotals: DailyEnergyTotals | undefined,
    timestamp: number
): CardDetails {
    const chargeLevelString = `${batteryInfo.percentage}%`;
    let activityDescription = "";
    let valueColorClassName = "text-muted-foreground"; 

    const { value: formattedPowerRateValue, unit: formattedPowerRateUnit } = formatPowerValue(Math.abs(currentBatteryPowerWatts), "W");
    const powerRateString = `${formattedPowerRateValue} ${formattedPowerRateUnit}`;

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
            activityDescription = `- Charging at ${powerRateString}`; // Fallback if sources are ambiguous
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
    } else { 
        activityDescription = "- Idle";
        if (batteryInfo.percentage >= 99) valueColorClassName = "text-green-500";
        else if (batteryInfo.percentage >= 70) valueColorClassName = "text-green-400";
        else if (batteryInfo.percentage >= 40) valueColorClassName = "text-yellow-500";
        else if (batteryInfo.percentage > 15) valueColorClassName = "text-orange-500";
        else valueColorClassName = "text-red-600";
    }

    const kwhInfoString = (typeof batteryInfo.energyKWh === 'number' && typeof batteryInfo.capacityKWh === 'number' && batteryInfo.capacityKWh > 0)
        ? `Charge: ${batteryInfo.energyKWh.toFixed(2)} kWh / ${batteryInfo.capacityKWh.toFixed(2)} kWh`
        : `Charge: N/A`;
    
    const descriptionElements: React.ReactNode[] = [];
    descriptionElements.push(<span key="kwhCap">{kwhInfoString}</span>);
    if (activityDescription) {
      descriptionElements.push(<span key="activity" className="block sm:inline sm:ml-1">{activityDescription}</span>);
    }
    descriptionElements.push(<span key="time" className="block text-xs text-muted-foreground sm:inline sm:ml-1">({new Date(timestamp).toLocaleTimeString()})</span>);

    if (dailyTotals) {
        const solarTotalGeneratedKWh = dailyTotals.solar || 0;
        const consumptionKWh = dailyTotals.consumption || 0;
        const gridImportKWh = dailyTotals.gridImport || 0;
        const batteryChargeTotalKWh = dailyTotals.batteryCharge || 0;
        const batteryDischargeTotalKWh = dailyTotals.batteryDischarge || 0;

        const consumptionMetByNonGridNonBattery = Math.max(0, consumptionKWh - gridImportKWh - batteryDischargeTotalKWh);
        const solarUsedForHomeKWh = Math.min(solarTotalGeneratedKWh, consumptionMetByNonGridNonBattery);
        const solarRemainingAfterHomeUse = Math.max(0, solarTotalGeneratedKWh - solarUsedForHomeKWh);
        const solarToBatteryKWh = Math.min(solarRemainingAfterHomeUse, batteryChargeTotalKWh);
        const gridToBatteryKWh = Math.max(0, batteryChargeTotalKWh - solarToBatteryKWh);

        const homeDemandMetByBatteryOrGrid = Math.max(0, consumptionKWh - solarUsedForHomeKWh);
        const batteryToHomeKWh = Math.min(batteryDischargeTotalKWh, homeDemandMetByBatteryOrGrid);
        const batteryToGridKWh = Math.max(0, batteryDischargeTotalKWh - batteryToHomeKWh);

        descriptionElements.push(<div key="chargeHeader" className="font-semibold mt-2 pt-1 border-t border-border/50">Battery In Today:</div>);
        descriptionElements.push(<div key="s2b-detail" className="pl-2">{`Solar to Battery: ${solarToBatteryKWh.toFixed(2)} kWh`}</div>);
        descriptionElements.push(<div key="totalCharge-detail" className="pl-2 font-medium">{`Total Charged: ${batteryChargeTotalKWh.toFixed(2)} kWh`}</div>);

        descriptionElements.push(<div key="dischargeHeader" className="font-semibold mt-1 pt-1 border-t border-border/50">Battery Out Today:</div>);
        descriptionElements.push(<div key="b2h-detail" className="pl-2">{`Battery to Home: ${batteryToHomeKWh.toFixed(2)} kWh`}</div>);
        descriptionElements.push(<div key="totalDischarge-detail" className="pl-2 font-medium">{`Total Discharged: ${batteryDischargeTotalKWh.toFixed(2)} kWh`}</div>);
    }

    const finalDescription = (
      <div className="space-y-0.5">
        {descriptionElements.map((el, index) => {
            if (React.isValidElement(el) && (el.key?.toString().startsWith("kwh") || el.key?.toString().startsWith("activity") || el.key?.toString().startsWith("time"))) {
                return (
                    <React.Fragment key={el.key}>
                        {el}
                        {index < descriptionElements.length -1 && !descriptionElements[index+1]?.key?.toString().includes("Header") && index !== descriptionElements.length -1 && (el.key?.toString().includes("kwh") || el.key?.toString().includes("activity")) ? " " : ""}
                    </React.Fragment>
                );
            }
            return el; 
        })}
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
    
    const descriptionElements: React.ReactNode[] = [];
    descriptionElements.push(<div key="flow">{flowDescription}</div>);

    if (typeof dailyGridImportKWh === 'number' && !isNaN(dailyGridImportKWh)) {
        descriptionElements.push(<div key="dailyImport">{`Today's Import: ${dailyGridImportKWh.toFixed(2)} kWh`}</div>);
    }
     if (typeof dailyGridExportKWh === 'number' && !isNaN(dailyGridExportKWh)) {
        descriptionElements.push(<div key="dailyExport">{`Today's Export: ${dailyGridExportKWh.toFixed(2)} kWh`}</div>);
    }
    descriptionElements.push(<div key="time" className="text-xs text-muted-foreground">{`Updated: ${new Date(timestamp).toLocaleTimeString()}`}</div>);
    
    const descriptionNode = (
      <div className="space-y-0.5">
        {descriptionElements.map((el, index) => <div key={index}>{el}</div> )}
      </div>
    );


    return { title: "Grid Status", ...formattedGrid, value: Math.abs(formattedGrid.value as number), icon: <Power className="h-6 w-6" />, description: descriptionNode, valueColorClassName: color, className: "min-h-[120px]" };
}


function getEVChargerCardDetails(
    evData: EVChargerStatusType,
    timestamp: number
): CardDetails {
    const formattedEV = formatPowerValue(evData.value, evData.unit);
    let valueColor = "text-muted-foreground";
    let icon = <PlugZap className="h-6 w-6" />;

    // Use the numeric value in Watts (if available) for color logic
    let powerInWatts = 0;
    if (typeof evData.value === 'number') {
        powerInWatts = evData.unit === 'kW' ? evData.value * 1000 : evData.value;
    }


    if (powerInWatts > POWER_FLOW_THRESHOLD_WATTS) { 
        valueColor = "text-green-500";
        icon = <Bolt className="h-6 w-6 text-green-500" />;
    } else if (React.isValidElement(evData.status)) {
        // Attempt to infer status from the ReactNode's class or content if needed
        const statusString = (evData.status.props.children as string)?.toLowerCase();
        if (statusString && statusString.includes('fault')) {
            valueColor = "text-red-600";
            icon = <AlertTriangle className="h-6 w-6 text-red-600" />;
        } else { 
             valueColor = "text-blue-500"; // Default for non-charging, non-faulted
             icon = <PlugZap className="h-6 w-6 text-blue-500" />;
        }
    }
    // If evData.value was "N/A", powerInWatts is 0, so it might fall into blue if status is not fault
    else if (evData.value === "N/A" && React.isValidElement(evData.status)) {
        const statusString = (evData.status.props.children as string)?.toLowerCase();
        if (statusString && statusString.includes('fault')) {
            valueColor = "text-red-600";
            icon = <AlertTriangle className="h-6 w-6 text-red-600" />;
        } else {
            valueColor = "text-blue-500";
            icon = <PlugZap className="h-6 w-6 text-blue-500" />;
        }
    }
     else { // Default if status is not a React element (e.g. raw string) or value is not "N/A" but power is low
        valueColor = "text-blue-500";
        icon = <PlugZap className="h-6 w-6 text-blue-500" />;
    }    

    const evChargerStatusMap: { [key: string]: string } = {
        Available: 'The EV charger is not plugged in to a vehicle',
        Preparing: 'The EV charger is plugged into a vehicle and is ready to start a charge',
        Charging: 'The EV charger is charging the connected EV',
        SuspendedEVSE: 'The charging session has been stopped by the EV charger',
        SuspendedEV: 'The charging session has been stopped by the EV',
        Finishing: 'The charging session has finished, but the EV charger is not ready to start a new charging session',
        Reserved: 'The EV charger has been reserved for a future charging session',
        Unavailable: 'The EV charger cannot start new charging sessions',
        Faulted: 'The EV charger is reporting an error',
        Unknown: 'Unknown Status', // Added a fallback for unexpected values
    };

    const evChargerStatusColorMap: { [key: string]: string } = {
        Available: 'text-blue-400',
        Preparing: 'text-blue-500',
        Charging: 'text-green-500',
        SuspendedEVSE: 'text-orange-500',
        SuspendedEV: 'text-orange-500',
        Finishing: 'text-red-600',
        Reserved: 'text-blue-500',
        Unavailable: 'text-red-600',
        Faulted: 'text-red-600',
        Unknown: 'text-red-600', // Fallback color
    };
    
    const descriptionElements: React.ReactNode[] = [];
    let statusText: string | React.ReactNode = 'Unknown Status';
    let mappedDescription = 'Unknown Status';
    
    if (evData.rawStatus) {
      statusText = evData.rawStatus;
      mappedDescription = evChargerStatusMap[evData.rawStatus as keyof typeof evChargerStatusMap] || evData.rawStatus;
    } else if (React.isValidElement(evData.status)) {
      // Attempt to infer status from the ReactNode's children as a fallback
      statusText = (evData.status.props.children as string) || 'Unknown Status';
      mappedDescription = evChargerStatusMap[statusText as keyof typeof evChargerStatusMap] || statusText;
    }

    descriptionElements.push(
      <p key="status" className={cn(evChargerStatusColorMap[evData.rawStatus as keyof typeof evChargerStatusColorMap] || 'text-muted-foreground')}>
        {`${statusText} (${mappedDescription})`}
      </p>
    );
    if (typeof evData.dailyTotalKWh === 'number' && !isNaN(evData.dailyTotalKWh)) {
        descriptionElements.push(<div key="dailyTotal">{`Today's Energy: ${evData.dailyTotalKWh.toFixed(1)} kWh`}</div>);
    } else {
        descriptionElements.push(<div key="dailyTotal">{`Today's Energy: N/A`}</div>);
    }
    if (typeof evData.sessionKWhDelivered === 'number' && !isNaN(evData.sessionKWhDelivered)) {
        descriptionElements.push(<div key="sessionTotal">{`Session Energy: ${evData.sessionKWhDelivered.toFixed(1)} kWh`}</div>);
    } else {
        descriptionElements.push(<div key="sessionTotal">{`Session Energy: N/A`}</div>);
    }
    descriptionElements.push(<div key="time" className="text-xs text-muted-foreground">{`Updated: ${new Date(timestamp).toLocaleTimeString()}`}</div>);

    const descriptionNode = (
      <div className="space-y-0.5">
        {descriptionElements.map((el, index) => <div key={index}>{el}</div> )}
      </div>
    );

    return { title: "EV Charger", ...formattedEV, icon, description: descriptionNode, valueColorClassName: valueColor, className: "min-h-[120px]" };
}
    

export function DashboardGrid({ apiKey }: DashboardGridProps) {
  const [showEvChargerCard, setShowEvChargerCard] = useState(true); // State to control EV Charger card visibility and data fetching

  const { data, isLoading, error, evChargersData, evChargerMeterData, refetch, fetchEvChargers } = useGivEnergyData(apiKey, showEvChargerCard);

  useEffect(() => {
    if (showEvChargerCard && (evChargersData === null || evChargerMeterData === null)) fetchEvChargers();
  }, [showEvChargerCard, evChargersData, evChargerMeterData, fetchEvChargers]);

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
          <Card className="shadow-lg h-full min-h-[300px] md:min-h-[400px]"><CardContent className="p-6 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></CardContent></Card>
          <DashboardCard 
              title="EV Charger" 
              value="0" 
              unit="kW" 
              icon={<PlugZap className="h-6 w-6"/>} 
              isLoading={true} 
              className="min-h-[120px]" />
        </div>
        <div className="md:col-span-1 space-y-4 flex flex-col">
          {["Home Consumption", "Solar Generation", "Battery Status", "Grid Status"].map(title => (
            <DashboardCard 
              key={title} 
              title={title} 
              value="0" 
              unit={title === "Battery Status" ? "%" : "kW"} 
              icon={
                title === "Home Consumption" ? <Home className="h-6 w-6"/> :
                title === "Solar Generation" ? <Sun className="h-6 w-6"/> :
                title === "Battery Status" ? <BatteryCharging className="h-6 w-6"/> :
                <Power className="h-6 w-6"/> 
              } 
              isLoading={true} 
              className="min-h-[120px]" />
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
          <Button onClick={refetch} className="mt-4">Try Again</Button>
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
  const solarDetails = getSolarGenerationCardDetails(data.solarGeneration, data.today, data.timestamp);
  const batteryDetails = getBatteryCardDetails(
    data.battery, 
    data.battery.rawPowerWatts, 
    data.rawGridPowerWatts, 
    data.rawSolarPowerWatts, 
    data.today, 
    data.timestamp
  );
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
