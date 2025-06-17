
"use client";

import type { RealTimeData, EVChargerStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const THRESHOLD_WATTS = 5; // Watts

const getWatts = (value: number | string, unit: string): number => {
  if (typeof value !== 'number') return 0;
  return unit === 'kW' ? value * 1000 : value;
};

export function EnergyFlowVisual({ data }: EnergyFlowVisualProps) {
  if (!data) {
    return (
      <Card className="h-full min-h-[400px] md:min-h-[500px] flex items-center justify-center shadow-lg bg-background text-foreground">
        <CardHeader>
          <CardTitle className="flex items-center text-lg md:text-xl">
            <Zap className="mr-2 h-5 w-5 text-primary" />
            Energy Flow
          </CardTitle>
        </CardHeader>
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
    rawGridPowerWatts,
    rawSolarPowerWatts,
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

  // Solar contributions
  const solarToHomeW = Math.min(solarGenerationWatts, homeConsumptionWatts);
  const isSolarToHome = solarToHomeW > THRESHOLD_WATTS;
  let solarRemainingAfterHomeW = Math.max(0, solarGenerationWatts - solarToHomeW);

  let evChargingFromSolarW = 0;
  let isEvChargingFromSolar = false;
  if (evChargerPowerWatts > THRESHOLD_WATTS) {
    evChargingFromSolarW = Math.min(solarRemainingAfterHomeW, evChargerPowerWatts);
    isEvChargingFromSolar = evChargingFromSolarW > THRESHOLD_WATTS;
    solarRemainingAfterHomeW = Math.max(0, solarRemainingAfterHomeW - evChargingFromSolarW);
  }

  const solarToBatteryW = batteryIsCharging ? Math.min(solarRemainingAfterHomeW, batteryAbsPowerW) : 0;
  const isSolarToBattery = solarToBatteryW > THRESHOLD_WATTS;
  let solarRemainingAfterBatteryW = Math.max(0, solarRemainingAfterHomeW - solarToBatteryW);

  const solarToGridW = gridIsExporting ? Math.min(solarRemainingAfterBatteryW, Math.abs(rawGridPowerWatts)) : 0;
  const isSolarToGrid = solarToGridW > THRESHOLD_WATTS;

  // Home demand fulfillment
  let remainingHomeDemandAfterSolarW = Math.max(0, homeConsumptionWatts - solarToHomeW);

  const gridToHomeW = (gridIsImporting && remainingHomeDemandAfterSolarW > THRESHOLD_WATTS) ? Math.min(Math.abs(rawGridPowerWatts), remainingHomeDemandAfterSolarW) : 0;
  const isGridToHome = gridToHomeW > THRESHOLD_WATTS;
  let remainingHomeDemandAfterSolarAndGridW = Math.max(0, remainingHomeDemandAfterSolarW - gridToHomeW);

  const batteryToHomeW = (batteryIsDischarging && remainingHomeDemandAfterSolarAndGridW > THRESHOLD_WATTS) ? Math.min(batteryAbsPowerW, remainingHomeDemandAfterSolarAndGridW) : 0;
  const isBatteryToHome = batteryToHomeW > THRESHOLD_WATTS;

  let batteryPowerAvailableForGridOrEvW = batteryIsDischarging ? Math.max(0, batteryAbsPowerW - batteryToHomeW) : 0;

  let evChargingFromBatteryW = 0;
  let isEvChargingFromBattery = false;
  const evDemandNotMetBySolar = Math.max(0, evChargerPowerWatts - evChargingFromSolarW);
  if (evDemandNotMetBySolar > THRESHOLD_WATTS && batteryIsDischarging) {
    evChargingFromBatteryW = Math.min(batteryPowerAvailableForGridOrEvW, evDemandNotMetBySolar);
    isEvChargingFromBattery = evChargingFromBatteryW > THRESHOLD_WATTS;
    batteryPowerAvailableForGridOrEvW = Math.max(0, batteryPowerAvailableForGridOrEvW - evChargingFromBatteryW);
  }

  const gridExportDemandNotMetBySolar = gridIsExporting ? Math.max(0, Math.abs(rawGridPowerWatts) - solarToGridW) : 0;
  const batteryToGridW = (gridIsExporting && batteryIsDischarging && gridExportDemandNotMetBySolar > THRESHOLD_WATTS) ? Math.min(batteryPowerAvailableForGridOrEvW, gridExportDemandNotMetBySolar) : 0;
  const isBatteryToGrid = batteryToGridW > THRESHOLD_WATTS;

  let gridPowerAvailableForEvOrBatteryW = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW) : 0;
  
  let evChargingFromGridW = 0;
  let isEvChargingFromGrid = false;
  const evDemandNotMetBySolarOrBattery = Math.max(0, evDemandNotMetBySolar - evChargingFromBatteryW);
  if (evDemandNotMetBySolarOrBattery > THRESHOLD_WATTS && gridIsImporting) {
    evChargingFromGridW = Math.min(gridPowerAvailableForEvOrBatteryW, evDemandNotMetBySolarOrBattery);
    isEvChargingFromGrid = evChargingFromGridW > THRESHOLD_WATTS;
    gridPowerAvailableForEvOrBatteryW = Math.max(0, gridPowerAvailableForEvOrBatteryW - evChargingFromGridW);
  }

  const batteryChargeDemandNotMetBySolar = batteryIsCharging ? Math.max(0, batteryAbsPowerW - solarToBatteryW) : 0;
  const gridToBatteryW = (gridIsImporting && batteryIsCharging && batteryChargeDemandNotMetBySolar > THRESHOLD_WATTS) ? Math.min(gridPowerAvailableForEvOrBatteryW, batteryChargeDemandNotMetBySolar) : 0;
  const isGridToBattery = gridToBatteryW > THRESHOLD_WATTS;

  const getBatteryIconSized = (className = "h-8 w-8 md:h-10 md:w-10") => {
    if (batteryIsCharging) return <BatteryCharging className={`${className} text-blue-500`} />;
    if (battery.percentage > 80) return <BatteryFull className={`${className} text-green-500`} />;
    if (battery.percentage > 40) return <BatteryMedium className={`${className} text-yellow-500`} />;
    if (battery.percentage > 10) return <BatteryLow className={`${className} text-orange-500`} />;
    return <BatteryWarning className={`${className} text-red-600`} />;
  };

  const batteryNodePowerText = (batteryIsCharging || batteryIsDischarging) && batteryAbsPowerW > THRESHOLD_WATTS ? formatPowerForDisplay(batteryAbsPowerW) : "0 W";
  const gridNodePowerText = gridIsImporting || gridIsExporting ? formatPowerForDisplay(gridDisplayValueWatts) : "0 W";
  const evNodePowerText = evChargerPowerWatts > THRESHOLD_WATTS ? formatPowerForDisplay(evChargerPowerWatts) : (evCharger?.rawStatus as EVChargerStatus === "Charging" ? "0 W" : "Idle"); // Show 0W when idle but status is charging? Revisit this.

  const iconSize = 32;
  const iconOffset = iconSize / 2;
  const diagOffset = 12;

  const nodeSolarY = 50;
  const nodeHomeY = 175;
  const nodeBatteryX = 75; 
  const nodeGridX = 325; 
  const nodeEVX = 200;
  const nodeEVY = 300; 
  const centerX = 200;

  return (
    // Removed fragment as CardHeader and CardContent are direct children of Card
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[400px] md:min-h-[500px] bg-background text-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-lg md:text-xl">
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Energy Flow
        </CardTitle>
      </CardHeader>{/* Corrected closing tag */}
      <CardContent className="flex-grow flex flex-col justify-center items-center p-4 md:p-6 relative">
        <svg viewBox="0 0 400 400" className="w-full h-auto max-w-md">
          <defs>
            <marker id="arrowhead-green" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 5 1.75, 0 3.5" /></marker>
            <marker id="arrowhead-red" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 5 1.75, 0 3.5" /></marker>
            <marker id="arrowhead-orange" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 5 1.75, 0 3.5" /></marker>
            <marker id="arrowhead-blue" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto" fill="var(--color-blue-500, #3B82F6)"><polygon points="0 0, 5 1.75, 0 3.5" /></marker>
            <style type="text/css">
              {`
                .flow-text {
                  font-size: 10px; 
                  font-weight: 500;
                  fill: currentColor;
                  text-anchor: middle;
                }
              `}
            </style>{/* Corrected closing tag */}
          </defs>

          <Sun x={centerX - iconOffset} y={nodeSolarY - iconOffset} className="h-8 w-8 text-yellow-500" />
          <text x={centerX} y={nodeSolarY + iconOffset + 10} textAnchor="middle" className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text>
          <text x={centerX} y={nodeSolarY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">Solar</text>

          <Home x={centerX - iconOffset} y={nodeHomeY - iconOffset} className="h-8 w-8 text-primary" />{/* Corrected className syntax */}
          <text x={centerX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{formatPowerForDisplay(homeConsumptionWatts)}</text>
          <text x={centerX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">Home</text>

          <g transform={`translate(${nodeBatteryX - iconOffset}, ${nodeHomeY - iconOffset})`}>{getBatteryIconSized("h-8 w-8")}</g>
          <text x={nodeBatteryX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{batteryNodePowerText}</text>
          <text x={nodeBatteryX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>
          
          <Power x={nodeGridX - iconOffset} y={nodeHomeY - iconOffset} className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-green-500" : "text-muted-foreground")} /> {/* Grid export is typically green */}
          <text x={nodeGridX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text fill-current text-xs font-medium">{gridNodePowerText}</text>
          <text x={nodeGridX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

          <Car x={nodeEVX - iconOffset} y={nodeEVY - iconOffset} className={cn("h-8 w-8", evChargerPowerWatts > THRESHOLD_WATTS ? "text-green-500" : "text-muted-foreground")} />
          <text x={nodeEVX} y={nodeEVY + iconOffset + 10} textAnchor="middle" className="flow-text fill-current text-xs font-medium">{evNodePowerText}</text>
          <text x={nodeEVX} y={nodeEVY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">EV ({evCharger.rawStatus || 'N/A'})</text>

          {isSolarToHome && (<>
            <path d={`M ${centerX} ${nodeSolarY + iconOffset} L ${centerX} ${nodeHomeY - iconOffset}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX + 20} y={(nodeSolarY + nodeHomeY) / 2} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(solarToHomeW)}</text>
          </>)}

          {isSolarToBattery && (<>
            <path d={`M ${centerX - diagOffset} ${nodeSolarY + iconOffset - diagOffset/2} Q ${centerX - 90} ${(nodeSolarY + nodeHomeY) / 2 - 20}, ${nodeBatteryX + iconOffset} ${nodeHomeY - diagOffset - 10}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX - 70} y={(nodeSolarY + nodeHomeY) / 2 - 40} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(solarToBatteryW)}</text>
          </>)}

          {isSolarToGrid && (<>
            <path d={`M ${centerX + diagOffset} ${nodeSolarY + iconOffset - diagOffset/2} Q ${centerX + 90} ${(nodeSolarY + nodeHomeY) / 2 - 20}, ${nodeGridX - iconOffset} ${nodeHomeY - diagOffset - 10}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" /> {/* Solar export is green */}
            <text x={centerX + 70} y={(nodeSolarY + nodeHomeY) / 2 - 40} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(solarToGridW)}</text>
          </>)}
          
          {isEvChargingFromSolar && (<>
            <path d={`M ${centerX} ${nodeSolarY + iconOffset + 5} L ${centerX} ${nodeEVY - iconOffset}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX - 25} y={(nodeSolarY + nodeEVY) / 2 + 20} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(evChargingFromSolarW)}</text>
          </>)}

          {isGridToHome && (<>
            <path d={`M ${nodeGridX - iconOffset} ${nodeHomeY} L ${centerX + iconOffset} ${nodeHomeY}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(centerX + nodeGridX) / 2} y={nodeHomeY - 8} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(gridToHomeW)}</text>
          </>)}

          {isGridToBattery && (<>
            <path d={`M ${nodeGridX - iconOffset} ${nodeHomeY + diagOffset + 10} Q ${(nodeGridX + nodeBatteryX) / 2 + 30} ${nodeHomeY + 90}, ${nodeBatteryX + iconOffset} ${nodeHomeY + diagOffset + 10}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(nodeGridX + nodeBatteryX) / 2} y={nodeHomeY + 75} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(gridToBatteryW)}</text>
          </>)}

          {isEvChargingFromGrid && (<>
            <path d={`M ${nodeGridX - diagOffset} ${nodeHomeY + iconOffset + diagOffset*2} Q ${(nodeGridX + nodeEVX)/2 + 30} ${(nodeHomeY + nodeEVY)/2 + 40}, ${nodeEVX + diagOffset} ${nodeEVY - iconOffset + 5}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(nodeGridX + nodeEVX)/2 + 45} y={(nodeHomeY + nodeEVY)/2 + 60} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(evChargingFromGridW)}</text>
          </>)}

          {isBatteryToHome && (<>
            <path d={`M ${nodeBatteryX + iconOffset} ${nodeHomeY} L ${centerX - iconOffset} ${nodeHomeY}`} className="stroke-orange-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />
            <text x={(centerX + nodeBatteryX) / 2} y={nodeHomeY - 8} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(batteryToHomeW)}</text>
          </>)}
          
          {isBatteryToGrid && (<>
             <path d={`M ${nodeBatteryX + iconOffset} ${nodeHomeY - diagOffset -10} Q ${(nodeBatteryX + nodeGridX) / 2 - 30} ${nodeHomeY - 90}, ${nodeGridX - iconOffset} ${nodeHomeY - diagOffset -10}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" /> {/* Battery export is green */}
            <text x={(nodeBatteryX + nodeGridX) / 2} y={nodeHomeY - 75} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(batteryToGridW)}</text>
          </>)}

          {isEvChargingFromBattery && (<>
            <path d={`M ${nodeBatteryX + diagOffset} ${nodeHomeY + iconOffset + diagOffset*2} Q ${(nodeBatteryX + nodeEVX)/2 - 30} ${(nodeHomeY + nodeEVY)/2 + 40}, ${nodeEVX - diagOffset} ${nodeEVY - iconOffset + 5}`} className="stroke-orange-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />
            <text x={(nodeBatteryX + nodeEVX)/2 - 45} y={(nodeHomeY + nodeEVY)/2 + 60} className="flow-text fill-current text-xs font-medium">{formatPowerForDisplay(evChargingFromBatteryW)}</text>
          </>)}

        </svg>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 max-w-xs">
          <div className="flex items-center mb-1">
            {getBatteryIconSized("h-6 w-6 flex-shrink-0")}
            <span className="ml-2 text-sm font-semibold text-foreground">
              Battery: {battery.percentage}%
            </span>
          </div>
          <Progress value={battery.percentage} className="w-full h-3" />
        </div>
      </CardContent>
    </Card>
  );
}
