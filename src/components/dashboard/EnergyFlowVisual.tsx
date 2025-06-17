
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
import React from "react";

interface EnergyFlowVisualProps {
  data: RealTimeData | null;
}

const THRESHOLD_WATTS = 5; 

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
    evCharger,
    battery, 
    rawGridPowerWatts 
  } = data;

  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit);

  let evChargerPowerWatts = getWatts(evCharger.value, evCharger.unit);
  if (isNaN(evChargerPowerWatts)) {
    evChargerPowerWatts = 0;
  }

  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_WATTS;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_WATTS;
  const batteryAbsPowerW = Math.abs(effectiveBatteryPowerWatts);

  const gridIsImporting = rawGridPowerWatts < -THRESHOLD_WATTS;
  const gridIsExporting = rawGridPowerWatts > THRESHOLD_WATTS;
  
  const isEVCharging = evChargerPowerWatts > THRESHOLD_WATTS;
  const isEVAvailableFromData = evCharger && evCharger.rawStatus !== "unavailable";


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
  const evNodePowerText = isEVCharging ? formatPowerForDisplay(evChargerPowerWatts) : (isEVAvailableFromData ? (evCharger?.rawStatus || "Idle") : "N/A");

  const centerX = 200;
  const centerY = 150; 
  const nodeRadius = 60; 
  const iconSize = 32;
  const iconOffset = iconSize / 2;
  const diagOffset = 12; 

  const nodeSolarY = centerY - nodeRadius;
  const nodeHomeY = centerY;
  const nodeBatteryX = centerX - nodeRadius;
  const nodeGridX = centerX + nodeRadius;
  const nodeEVY = centerY + nodeRadius;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[400px] md:min-h-[500px] bg-background text-foreground">
      <CardContent className="flex-grow flex flex-col justify-center items-center p-4 md:p-6 relative">
        <svg viewBox="0 0 400 300" className="w-full h-auto max-w-md"> {/* Adjusted viewBox height */}
					<defs>
						<marker id="arrowhead-green" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-red" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-orange" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-blue" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-blue-500, #3B82F6)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<style type="text/css">
							{`
								.flow-text {
									font-size: 9px;
									font-weight: 500;
									fill: currentColor;
									text-anchor: middle;
								}
							`}
						</style>
					</defs>

          {/* Solar to Home */}
          {isSolarToHome && <line x1={centerX} y1={nodeSolarY + iconOffset} x2={centerX} y2={nodeHomeY - iconOffset} className="stroke-green-500" strokeWidth="2" markerEnd="url(#arrowhead-green)" />}
					{isSolarToHome && <text x={centerX + 10} y={(nodeSolarY + nodeHomeY)/2} className="flow-text">{formatPowerForDisplay(solarToHomeW)}</text>}
          
          {/* Solar to Battery */}
          {isSolarToBattery && <line x1={centerX - diagOffset} y1={nodeSolarY + diagOffset} x2={nodeBatteryX + iconOffset} y2={nodeHomeY - diagOffset} className="stroke-green-500" strokeWidth="2" markerEnd="url(#arrowhead-green)" />}
					{isSolarToBattery && <text x={(centerX + nodeBatteryX) / 2 - 5} y={(nodeSolarY + nodeHomeY) / 2 - 15} className="flow-text">{formatPowerForDisplay(solarToBatteryW)}</text>}

          {/* Solar to Grid */}
          {isSolarToGrid && <line x1={centerX + diagOffset} y1={nodeSolarY + diagOffset} x2={nodeGridX - iconOffset} y2={nodeHomeY - diagOffset} className="stroke-blue-500" strokeWidth="2" markerEnd="url(#arrowhead-blue)" />}
					{isSolarToGrid && <text x={(centerX + nodeGridX) / 2 + 5} y={(nodeSolarY + nodeHomeY) / 2 - 15} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>}

          {/* Solar to EV */}
          {isEVChargingFromSolar && <line x1={centerX} y1={nodeSolarY + iconOffset} x2={centerX} y2={nodeEVY - iconOffset} className="stroke-green-500" strokeWidth="2" markerEnd="url(#arrowhead-green)" />}
          {isEVChargingFromSolar && <text x={centerX - 10} y={(nodeSolarY + nodeEVY) / 2} className="flow-text" textAnchor="end">{formatPowerForDisplay(evChargingFromSolarW)}</text>}


          {/* Grid to Home */}
					{isGridToHome && <line x1={nodeGridX - iconOffset} y1={nodeHomeY} x2={centerX + iconOffset} y2={nodeHomeY} className="stroke-red-500" strokeWidth="2" markerEnd="url(#arrowhead-red)" />}
					{isGridToHome && <text x={(nodeGridX + centerX) / 2} y={nodeHomeY - 10} className="flow-text">{formatPowerForDisplay(gridToHomeW)}</text>}

          {/* Grid to Battery */}
					{isGridToBattery && <line x1={nodeGridX - diagOffset} y1={nodeHomeY + diagOffset} x2={nodeBatteryX + iconOffset} y2={nodeHomeY + diagOffset} className="stroke-red-500" strokeWidth="2" markerEnd="url(#arrowhead-red)" />}
					{isGridToBattery && <text x={(nodeGridX + nodeBatteryX) / 2} y={nodeHomeY + iconOffset + 5} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>}
          
          {/* Grid to EV */}
          {isEVChargingFromGrid && <line x1={nodeGridX - diagOffset} y1={nodeHomeY + diagOffset} x2={centerX + diagOffset} y2={nodeEVY - diagOffset} className="stroke-red-500" strokeWidth="2" markerEnd="url(#arrowhead-red)" />}
					{isEVChargingFromGrid && <text x={(centerX + nodeGridX)/2 + 15} y={(nodeHomeY + nodeEVY)/2 + 15} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>}


          {/* Battery to Home */}
					{isBatteryToHome && <line x1={nodeBatteryX + iconOffset} y1={nodeHomeY} x2={centerX - iconOffset} y2={nodeHomeY} className="stroke-orange-500" strokeWidth="2" markerEnd="url(#arrowhead-orange)" />}
					{isBatteryToHome && <text x={(nodeBatteryX + centerX) / 2} y={nodeHomeY - 10} className="flow-text">{formatPowerForDisplay(batteryToHomeW)}</text>}

          {/* Battery to Grid */}
					{isBatteryToGrid && <line x1={nodeBatteryX + diagOffset} y1={nodeHomeY - diagOffset} x2={nodeGridX - iconOffset} y2={nodeHomeY - diagOffset} className="stroke-blue-500" strokeWidth="2" markerEnd="url(#arrowhead-blue)" />}
					{isBatteryToGrid && <text x={(nodeBatteryX + nodeGridX) / 2} y={nodeHomeY - iconOffset - 5} className="flow-text">{formatPowerForDisplay(batteryToGridW)}</text>}
          
          {/* Battery to EV */}
					{isEVChargingFromBattery && <line x1={nodeBatteryX + diagOffset} y1={nodeHomeY + diagOffset} x2={centerX - diagOffset} y2={nodeEVY - diagOffset} className="stroke-orange-500" strokeWidth="2" markerEnd="url(#arrowhead-orange)" />}
					{isEVChargingFromBattery && <text x={(centerX + nodeBatteryX)/2 - 15} y={(nodeHomeY + nodeEVY)/2 + 15} className="flow-text" textAnchor="end">{formatPowerForDisplay(evChargingFromBatteryW)}</text>}

          {/* Icons and Labels */}
          <Home x={centerX - iconOffset} y={nodeHomeY - iconOffset} className="h-8 w-8 text-primary" />
          <text x={centerX} y={nodeHomeY + iconOffset + 8} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(homeConsumptionWatts)}</text>
          <text x={centerX} y={nodeHomeY + iconOffset + 18} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">Home</text>

          <Sun x={centerX - iconOffset} y={nodeSolarY - iconOffset} className="h-8 w-8 text-yellow-500" />
					<text x={centerX} y={nodeSolarY + iconOffset + 8} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text>
          <text x={centerX} y={nodeSolarY - iconOffset - 12} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">Solar</text>

          <Bolt x={nodeGridX - iconOffset} y={nodeHomeY - iconOffset} className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} />
					<text x={nodeGridX} y={nodeHomeY + iconOffset + 8} textAnchor="middle" className="fill-current text-xs font-medium">{gridNodePowerText}</text>
					<text x={nodeGridX} y={nodeHomeY + iconOffset + 18} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

					<g transform={`translate(${nodeBatteryX - iconOffset}, ${nodeHomeY - iconOffset})`}>
            {getBatteryIconSized("h-8 w-8")}
          </g>
					<text x={nodeBatteryX} y={nodeHomeY + iconOffset + 8} textAnchor="middle" className="fill-current text-xs font-medium">{batteryNodePowerText}</text>
					<text x={nodeBatteryX} y={nodeHomeY + iconOffset + 18} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>

					{isEVAvailableFromData && (
             <g transform={`translate(${centerX - iconOffset}, ${nodeEVY - iconOffset})`}>
              {isEVCharging ? (<Bolt className="h-8 w-8 text-green-500" />) : (<Car className="h-8 w-8 text-muted-foreground" />)}
						  </g>
					)}
					{isEVAvailableFromData && (<text x={centerX} y={nodeEVY + iconOffset + 8} textAnchor="middle" className="fill-current text-xs font-medium">{evNodePowerText}</text>)}
          {isEVAvailableFromData && (<text x={centerX} y={nodeEVY + iconOffset + 18} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">
            {isEVCharging 
              ? (evCharger?.rawStatus ? evCharger.rawStatus.charAt(0).toUpperCase() + evCharger.rawStatus.slice(1) : 'Charging') 
              : (evCharger?.rawStatus || 'Idle')}
          </text>)}
				</svg>

        <div className="absolute bottom-4 left-4 right-4 w-auto max-w-xs mx-auto">
          <div className="flex items-center mb-1">
            {getBatteryIconSized("h-5 w-5")}
            <span className="ml-2 text-sm font-semibold text-foreground">
              Battery: {battery.percentage}%
            </span>
          </div>
					<Progress value={battery.percentage} className="w-full h-1.5" /> {/* Slightly thinner progress bar */}
        </div>
      </CardContent>
    </Card>
  );
}

