
"use client";

import type { RealTimeData } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sun,
  Home,
  Power,
  BatteryCharging,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Car,
  Zap,
  Bolt
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import React from "react"; // Ensure React is imported for React.isValidElement

interface EnergyFlowVisualProps {
  data: RealTimeData | null;
}
interface EvCharger { 
  value: number | string; 
  unit: string; 
  status?: React.ReactNode; // This is the mapped status (ReactNode)
  rawStatus?: string; // This is the raw string status
  'Today\'s Energy'?: number | string; 
  'Session Energy'?: number | string; 
  'Current Charge'?: number | string; 
}

const THRESHOLD_WATTS = 5; // Reduced threshold for arrow visibility

const getWatts = (value: number | string, unit: string): number => {
  if (typeof value !== 'number') return 0;
  return unit === 'kW' ? value * 1000 : value;
};

export function EnergyFlowVisual({ data }: EnergyFlowVisualProps) {
  if (!data) {
    return (
      <Card className="h-full min-h-[300px] md:min-h-[450px] flex items-center justify-center shadow-lg">
        <CardContent>
          <p>Energy flow data unavailable.</p>
        </CardContent>
      </Card>
    );
  }

  const formatPowerForDisplay = (valueInWatts: number | string): string => {
    let originalWattsAsNumber: number;
    if (typeof valueInWatts === 'string') {
      originalWattsAsNumber = parseFloat(valueInWatts);
      if (isNaN(originalWattsAsNumber)) return "N/A";
    } else {
      originalWattsAsNumber = valueInWatts;
    }

    const absWatts = Math.abs(originalWattsAsNumber);

    if (absWatts < 1000) {
      return `${Math.round(absWatts)} W`;
    } else {
      return `${(absWatts / 1000).toFixed(2)} kW`;
    }
  };

  const {
    solarGeneration,
    homeConsumption,
    grid,
    evCharger, // This is RealTimeData.evCharger, which includes rawStatus
    battery,
    rawGridPowerWatts,
  } = data;

  // Process raw evCharger data into the EvCharger interface structure
  const processedEvCharger: EvCharger | undefined = evCharger ? {
    value: evCharger.value,
    unit: evCharger.unit,
    rawStatus: evCharger.rawStatus,
    status: evCharger.rawStatus ? (
      <span className={cn(
        "text-[10px] text-muted-foreground",
        evCharger.rawStatus === 'charging' && 'text-green-500',
        evCharger.rawStatus === 'error' && 'text-red-500',
        evCharger.rawStatus === 'idle' && 'text-muted-foreground',
      )}>
        {evCharger.rawStatus.charAt(0).toUpperCase() + evCharger.rawStatus.slice(1)}
      </span>
    ) : 'N/A', // Default to N/A if rawStatus is missing
  } : undefined;

  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit);

  let evChargerPowerWatts = 0;
  if (processedEvCharger && typeof processedEvCharger.value === 'number' && typeof processedEvCharger.unit === 'string') {
    evChargerPowerWatts = getWatts(processedEvCharger.value, processedEvCharger.unit);
  }

  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_WATTS;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_WATTS;
  const batteryAbsPowerW = Math.abs(effectiveBatteryPowerWatts);

  const gridIsImporting = rawGridPowerWatts < -THRESHOLD_WATTS;
  const gridIsExporting = rawGridPowerWatts > THRESHOLD_WATTS;

  const isEVCharging = evChargerPowerWatts > THRESHOLD_WATTS;
  const isEVAvailable = processedEvCharger !== undefined && processedEvCharger.rawStatus !== "unavailable";


  const solarToHomeW = Math.min(solarGenerationWatts, homeConsumptionWatts);
  const isSolarToHome = solarToHomeW > THRESHOLD_WATTS;

  const remainingHomeDemandAfterSolarW = Math.max(0, homeConsumptionWatts - solarToHomeW);
  const gridToHomeW = gridIsImporting ? Math.min(Math.abs(rawGridPowerWatts), remainingHomeDemandAfterSolarW) : 0;
  const isGridToHome = gridToHomeW > THRESHOLD_WATTS;

  const solarAvailableForEVOrBatteryW = Math.max(0, solarGenerationWatts - solarToHomeW);
  const evChargingFromSolarW = isEVCharging ? Math.min(solarAvailableForEVOrBatteryW, evChargerPowerWatts) : 0;
  const isEVChargingFromSolar = evChargingFromSolarW > THRESHOLD_WATTS;

  let remainingEVNeedsW = Math.max(0, evChargerPowerWatts - evChargingFromSolarW);
  const gridAvailableForEVOrBatteryW = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW) : 0;
  const evChargingFromGridW = isEVCharging ? Math.min(gridAvailableForEVOrBatteryW, remainingEVNeedsW) : 0;
  const isEVChargingFromGrid = evChargingFromGridW > THRESHOLD_WATTS;

  remainingEVNeedsW = Math.max(0, remainingEVNeedsW - evChargingFromGridW);
  const batteryDischargeAvailableForEVOrGridW = batteryIsDischarging ? batteryAbsPowerW : 0;
  const evChargingFromBatteryW = isEVCharging ? Math.min(batteryDischargeAvailableForEVOrGridW, remainingEVNeedsW) : 0;
  const isEVChargingFromBattery = evChargingFromBatteryW > THRESHOLD_WATTS;

  const homeDemandAfterSolarAndGridW = Math.max(0, homeConsumptionWatts - solarToHomeW - gridToHomeW);
  const batteryPowerForHomeOrGridW = Math.max(0, batteryAbsPowerW - evChargingFromBatteryW);
  const batteryToHomeW = batteryIsDischarging ? Math.min(batteryPowerForHomeOrGridW, homeDemandAfterSolarAndGridW) : 0;
  const isBatteryToHome = batteryToHomeW > THRESHOLD_WATTS;

  const solarRemainingAfterHomeAndEVW = Math.max(0, solarGenerationWatts - solarToHomeW - evChargingFromSolarW);
  const solarToBatteryW = batteryIsCharging ? Math.min(solarRemainingAfterHomeAndEVW, batteryAbsPowerW) : 0;
  const isSolarToBattery = solarToBatteryW > THRESHOLD_WATTS;

  const gridRemainingAfterHomeAndEVW = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW - evChargingFromGridW) : 0;
  const gridToBatteryW = batteryIsCharging ? Math.min(gridRemainingAfterHomeAndEVW, batteryAbsPowerW) : 0;
  const isGridToBattery = gridToBatteryW > THRESHOLD_WATTS;

  const solarRemainingForGridExportW = Math.max(0, solarGenerationWatts - solarToHomeW - evChargingFromSolarW - solarToBatteryW);
  const solarToGridW = gridIsExporting ? Math.min(solarRemainingForGridExportW, Math.abs(rawGridPowerWatts)) : 0;
  const isSolarToGrid = solarToGridW > THRESHOLD_WATTS;

  const batteryRemainingForGridExportW = Math.max(0, batteryAbsPowerW - batteryToHomeW - evChargingFromBatteryW);
  const batteryToGridW = gridIsExporting ? Math.min(batteryRemainingForGridExportW, Math.abs(rawGridPowerWatts)) : 0;
  const isBatteryToGrid = batteryToGridW > THRESHOLD_WATTS;

  const getBatteryIconSized = (className = "h-8 w-8") => {
    if (batteryIsCharging) return <BatteryCharging className={`${className} text-blue-500`} />;
    if (battery.percentage > 80) return <BatteryFull className={`${className} text-green-500`} />;
    if (battery.percentage > 40) return <BatteryMedium className={`${className} text-yellow-500`} />;
    if (battery.percentage > 10) return <BatteryLow className={`${className} text-orange-500`} />;
    return <BatteryWarning className={`${className} text-red-600`} />;
  };

  const batteryNodePowerText = batteryIsCharging || batteryIsDischarging ? formatPowerForDisplay(batteryAbsPowerW) : "0 W";
  const gridNodePowerText = gridIsImporting || gridIsExporting ? formatPowerForDisplay(gridDisplayValueWatts) : "0 W";
  const evNodePowerText = isEVCharging ? formatPowerForDisplay(evChargerPowerWatts) : (isEVAvailable ? (processedEvCharger?.rawStatus || "Idle") : "N/A");

  // Define positions for the circular layout
  const centerX = 200;
  const centerY = 200;
  const radius = 120;
  const nodeSize = 60; // Size of the circular node container

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[400px] md:min-h-[500px] bg-background text-foreground">
      <CardContent className="flex-grow flex flex-col justify-center items-center p-4 md:p-6 relative">
        <svg viewBox="0 0 400 400" className="w-full h-auto max-w-md">
					<defs>
						<marker id="arrowhead-green" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-red" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-orange" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-blue" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-blue-500, #3B82F6)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-solar-ev" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-grid-ev" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-battery-ev" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<style type="text/css">
							{`
								.flow-text {
									font-size: 10px;
									font-weight: medium;
									fill: currentColor;
									text-anchor: middle;
									dominant-baseline: middle;
								}
							`}
						</style>
					</defs>

          {/* Solar to Home */}
          {isSolarToHome && <path d={`M ${centerX},${centerY - radius} C ${centerX},${centerY - radius / 2} ${centerX},${centerY - radius / 2} ${centerX},${centerY}`} className="stroke-green-500" strokeWidth="2" fill="none" markerEnd="url(#arrowhead-green)" />}
					{isSolarToHome && (<text x={centerX + 15} y={centerY - radius / 2} className="flow-text">{formatPowerForDisplay(solarToHomeW)}</text>)} {/* Adjusted text position */}

          {/* Solar to Battery */}
          {isSolarToBattery && <path d={`M ${centerX},${centerY - radius} C ${centerX - radius / 2},${centerY - radius / 2} ${centerX - radius},${centerY} ${centerX - radius},${centerY}`} className="stroke-green-500" strokeWidth="2" fill="none" markerEnd="url(#arrowhead-green)" />}
					{isSolarToBattery && (<text x={centerX - radius / 2} y={centerY - radius / 2 - 10} className="flow-text" textAnchor="end">{formatPowerForDisplay(solarToBatteryW)}</text>)} {/* Adjusted text position */}

          {/* Solar to Grid */}
          {isSolarToGrid && <path d={`M ${centerX},${centerY - radius} C ${centerX + radius / 2},${centerY - radius / 2} ${centerX + radius},${centerY} ${centerX + radius},${centerY}`} className="stroke-blue-500" strokeWidth="2" fill="none" markerEnd="url(#arrowhead-blue)" />}
					{isSolarToGrid && (<text x={centerX + radius / 2} y={centerY - radius / 4} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>)} {/* Adjusted text position */}

          {/* Solar to EV */}
          {isEVChargingFromSolar && isEVCharging && (
             <path
              d={`M ${centerX},${centerY - radius} C ${centerX + radius / 4},${centerY - radius} ${centerX + radius},${centerY - radius / 4} ${centerX + radius},${centerY - radius / 2}`}
              className="stroke-green-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-solar-ev)"
            />
          )}
					{isEVChargingFromSolar && isEVAvailable && (<text x={centerX + radius / 2 - 10} y={centerY - radius / 2 - 10} className="flow-text">{formatPowerForDisplay(evChargingFromSolarW)}</text>)} {/* Adjusted text position */}

          {/* Grid to Home */}
					{isGridToHome && (
            <path
              d={`M ${centerX + radius},${centerY} C ${centerX + radius / 2},${centerY} ${centerX + radius / 2},${centerY} ${centerX},${centerY}`}
              className="stroke-red-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-red)"
            />
          )}
					{isGridToHome && (<text x={centerX + radius / 2} y={centerY + 15} className="flow-text">{formatPowerForDisplay(gridToHomeW)}</text>)} {/* Adjusted text position */}

          {/* Grid to Battery */}
					{isGridToBattery && (
            <path
              d={`M ${centerX + radius},${centerY} C ${centerX + radius / 2},${centerY + radius / 2} ${centerX},${centerY + radius} ${centerX - radius},${centerY}`}
              className="stroke-red-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-red)"
            />
          )}
					{isGridToBattery && (<text x={centerX + radius / 2} y={centerY + radius / 4} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>)} {/* Adjusted text position */}

          {/* Grid to EV */}
          {isEVChargingFromGrid && isEVCharging && (
            <path
              d={`M ${centerX + radius},${centerY} C ${centerX + radius / 2},${centerY - radius / 2} ${centerX + radius},${centerY - radius} ${centerX + radius - nodeSize / 2},${centerY - radius}`}
              className="stroke-red-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-grid-ev)"
            />
          )}
					{isEVChargingFromGrid && isEVAvailable && (<text x={centerX + radius - nodeSize / 2 - 10} y={centerY - radius / 2 - 10} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>)} {/* Adjusted text position */}

          {/* Battery to Home */}
					{isBatteryToHome && (
            <path
              d={`M ${centerX - radius - nodeSize / 2},${centerY} C ${centerX - radius / 2},${centerY} ${centerX - radius / 2},${centerY} ${centerX - nodeSize / 2},${centerY}`}
              className="stroke-orange-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-orange)"
            />
          )}
					{isBatteryToHome && (<text x={centerX - radius / 2} y={centerY + 15} className="flow-text" textAnchor="end">{formatPowerForDisplay(batteryToHomeW)}</text>)} {/* Adjusted text position */}

          {/* Battery to Grid */}
					{isBatteryToGrid && (
            <path
              d={`M ${centerX - radius},${centerY} C ${centerX - radius / 2},${centerY - radius / 2} ${centerX},${centerY - radius} ${centerX + radius},${centerY}`}
              className="stroke-blue-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-blue)"
            />
          )}
					{isBatteryToGrid && (<text x={centerX - radius / 2} y={centerY - radius / 4} className="flow-text" textAnchor="end">{formatPowerForDisplay(batteryToGridW)}</text>)} {/* Adjusted text position */}

          {/* Battery to EV */}
					{isEVChargingFromBattery && isEVCharging && (
             <path
              d={`M ${centerX - radius - nodeSize / 2},${centerY} C ${centerX - radius / 2},${centerY - radius / 2} ${centerX + radius - nodeSize / 2},${centerY - radius + nodeSize / 2} ${centerX + radius - nodeSize / 2},${centerY - radius + nodeSize / 2}`}
              className="stroke-orange-500"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead-battery-ev)"
            />
          )}
					{isEVChargingFromBattery && isEVAvailable && (<text x={centerX - radius / 2} y={centerY - radius / 2 - 10} className="flow-text" textAnchor="end">{formatPowerForDisplay(evChargingFromBatteryW)}</text>)} {/* Adjusted text position */}

          {/* Icons and Labels */}
          {/* Central Home Icon */}
          <Home x={centerX - 20} y={centerY - 20} className="h-10 w-10 text-primary" /> {/* Adjusted icon position and size */}
          {/* Home Text */}
          <text x={centerX} y={centerY + 30} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(homeConsumptionWatts)}</text> {/* Adjusted text position */}
          <text x={centerX} y={centerY + 42} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">Home</text> {/* Adjusted text position */}

          {/* Solar Node (Top) */}
          <Sun x={centerX - 20} y={centerY - radius - 20} className="h-10 w-10 text-yellow-500" /> {/* Adjusted icon position and size */}
					<text x={centerX} y={centerY - radius - 10} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text> {/* Adjusted text position */}
          <text x={centerX} y={centerY - radius - 22} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">Solar</text> {/* Adjusted text position */}

          {/* Grid Node (Bottom Right) */}
          <Bolt x={centerX + radius - 20} y={centerY - 20} className={cn("h-10 w-10", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} /> {/* Adjusted icon position and size */}
					<text x={centerX + radius + 30} y={centerY} textAnchor="start" dominantBaseline="middle" className="fill-current text-xs font-medium">{gridNodePowerText}</text> {/* Adjusted text position */}
					<text x={centerX + radius + 30} y={centerY + 12} textAnchor="start" dominantBaseline="middle" className="fill-current text-[10px] text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text> {/* Adjusted text position */}

          {/* Battery Node (Bottom Left) */}
					<g transform={`translate(${centerX - radius - 20}, ${centerY - 20})`}> {/* Adjusted group position */}
            {getBatteryIconSized("h-10 w-10")} {/* Adjusted icon size */}
          </g>
					<text x={centerX - radius - 30} y={centerY} textAnchor="end" dominantBaseline="middle" className="fill-current text-xs font-medium">{batteryNodePowerText}</text> {/* Adjusted text position */}
					<text x={centerX - radius - 30} y={centerY + 12} textAnchor="end" dominantBaseline="middle" className="fill-current text-[10px] text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text> {/* Adjusted text position */}

          {/* EV Node (Top Right) */}
					{isEVAvailable && (
             <g transform={`translate(${centerX + radius - 20}, ${centerY - radius - 20})`}> {/* Adjusted EV position */}
              {isEVCharging ? (<Bolt className="h-10 w-10 text-green-500" />) : (<Car className="h-10 w-10 text-muted-foreground" />)} {/* Adjusted icon size */}
						  </g>
					)} {/* Only show G element if EV is available */}
          {/* Use processed status for SVG text node */}
					{isEVAvailable && (<text x={centerX + radius} y={centerY - radius - 10} textAnchor="middle" className="fill-current text-xs font-medium">{evNodePowerText}</text>)} {/* Adjusted text position */}
					{isEVAvailable && (<text x={centerX + radius} y={centerY - radius - 22} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">{isEVCharging ? (evCharger?.rawStatus ? evCharger.rawStatus.charAt(0).toUpperCase() + evCharger.rawStatus.slice(1) : 'Charging') : 'Idle'}</text>)} {/* Adjusted text position */}
				</svg>

        {/* Battery percentage linear progress bar at the bottom */}
        {/* Removed battery percentage display from circular layout, it's now below */}
        {/* Keep the linear progress bar at the bottom as it was */}
				<div className="absolute bottom-4 left-4 right-4 w-auto max-w-sm mx-auto">
          <div className="flex items-center mb-1">
            {getBatteryIconSized("h-5 w-5")}
            <span className="ml-2 text-sm font-semibold text-foreground">
              Battery: {battery.percentage}%
            </span>
          </div>
					<Progress value={battery.percentage} className="w-full h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

