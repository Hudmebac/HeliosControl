
"use client";

import type { RealTimeData } from "@/lib/types";
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
  } = data;

  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;
  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit);
  let evChargerPowerWatts = getWatts(evCharger.value, evCharger.unit);
  if (isNaN(evChargerPowerWatts)) { // Ensure evChargerPowerWatts is a number
    evChargerPowerWatts = 0;
  }


  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_WATTS;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_WATTS;
  const batteryAbsPowerW = Math.abs(effectiveBatteryPowerWatts);

  const gridIsImporting = rawGridPowerWatts < -THRESHOLD_WATTS;
  const gridIsExporting = rawGridPowerWatts > THRESHOLD_WATTS;

  const solarToHomeW = Math.min(solarGenerationWatts, homeConsumptionWatts);
  const isSolarToHome = solarToHomeW > THRESHOLD_WATTS;

  const solarRemainingAfterHomeW = Math.max(0, solarGenerationWatts - solarToHomeW);
  
  const remainingHomeDemandAfterSolarW = Math.max(0, homeConsumptionWatts - solarToHomeW);
  const gridToHomeW = gridIsImporting ? Math.min(Math.abs(rawGridPowerWatts), remainingHomeDemandAfterSolarW) : 0;
  const isGridToHome = gridToHomeW > THRESHOLD_WATTS;

  const homeDemandAfterSolarAndGridW = Math.max(0, homeConsumptionWatts - solarToHomeW - gridToHomeW);
  const batteryToHomeW = batteryIsDischarging ? Math.min(batteryAbsPowerW, homeDemandAfterSolarAndGridW) : 0;
  const isBatteryToHome = batteryToHomeW > THRESHOLD_WATTS;

  let evChargingFromSolarW = 0;
  let isEvChargingFromSolar = false;
  let solarAvailableForOtherUses = solarRemainingAfterHomeW;

  if (evChargerPowerWatts > THRESHOLD_WATTS) {
    evChargingFromSolarW = Math.min(solarAvailableForOtherUses, evChargerPowerWatts);
    isEvChargingFromSolar = evChargingFromSolarW > THRESHOLD_WATTS;
    solarAvailableForOtherUses = Math.max(0, solarAvailableForOtherUses - evChargingFromSolarW);
  }

  const solarToBatteryW = batteryIsCharging ? Math.min(solarAvailableForOtherUses, batteryAbsPowerW) : 0;
  const isSolarToBattery = solarToBatteryW > THRESHOLD_WATTS;
  solarAvailableForOtherUses = Math.max(0, solarAvailableForOtherUses - solarToBatteryW);
  
  const solarToGridW = gridIsExporting ? Math.min(solarAvailableForOtherUses, Math.abs(rawGridPowerWatts)) : 0;
  const isSolarToGrid = solarToGridW > THRESHOLD_WATTS;

  let evChargingFromBatteryW = 0;
  let isEvChargingFromBattery = false;
  let batteryAvailableForOtherUses = batteryIsDischarging ? Math.max(0, batteryAbsPowerW - batteryToHomeW) : 0;

  if (evChargerPowerWatts > THRESHOLD_WATTS && (evChargerPowerWatts - evChargingFromSolarW) > THRESHOLD_WATTS && batteryIsDischarging) {
    const evDemandFromBattery = evChargerPowerWatts - evChargingFromSolarW;
    evChargingFromBatteryW = Math.min(batteryAvailableForOtherUses, evDemandFromBattery);
    isEvChargingFromBattery = evChargingFromBatteryW > THRESHOLD_WATTS;
    batteryAvailableForOtherUses = Math.max(0, batteryAvailableForOtherUses - evChargingFromBatteryW);
  }
  
  const batteryToGridW = gridIsExporting ? Math.min(batteryAvailableForOtherUses, Math.abs(rawGridPowerWatts) - solarToGridW) : 0;
  const isBatteryToGrid = batteryToGridW > THRESHOLD_WATTS;

  let evChargingFromGridW = 0;
  let isEvChargingFromGrid = false;
  let gridAvailableForOtherUses = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW) : 0;

  if (evChargerPowerWatts > THRESHOLD_WATTS && (evChargerPowerWatts - evChargingFromSolarW - evChargingFromBatteryW) > THRESHOLD_WATTS && gridIsImporting) {
    const evDemandFromGrid = evChargerPowerWatts - evChargingFromSolarW - evChargingFromBatteryW;
    evChargingFromGridW = Math.min(gridAvailableForOtherUses, evDemandFromGrid);
    isEvChargingFromGrid = evChargingFromGridW > THRESHOLD_WATTS;
    gridAvailableForOtherUses = Math.max(0, gridAvailableForOtherUses - evChargingFromGridW);
  }

  const gridToBatteryW = batteryIsCharging ? Math.min(gridAvailableForOtherUses, batteryAbsPowerW - solarToBatteryW) : 0;
  const isGridToBattery = gridToBatteryW > THRESHOLD_WATTS;

  const getBatteryIconSized = (className = "h-8 w-8 md:h-10 md:w-10") => { // Larger icons
    if (batteryIsCharging) return <BatteryCharging className={`${className} text-blue-500`} />;
    if (battery.percentage > 80) return <BatteryFull className={`${className} text-green-500`} />;
    if (battery.percentage > 40) return <BatteryMedium className={`${className} text-yellow-500`} />;
    if (battery.percentage > 10) return <BatteryLow className={`${className} text-orange-500`} />;
    return <BatteryWarning className={`${className} text-red-600`} />;
  };

  const batteryNodePowerText = batteryIsCharging || batteryIsDischarging ? formatPowerForDisplay(batteryAbsPowerW) : "0 W";
  const gridNodePowerText = gridIsImporting || gridIsExporting ? formatPowerForDisplay(gridDisplayValueWatts) : "0 W"; // Uses gridDisplayValueWatts which is abs
  const evNodePowerText = evChargerPowerWatts > THRESHOLD_WATTS ? formatPowerForDisplay(evChargerPowerWatts) : "0 W";

  const iconSize = 40; 
  const iconOffset = iconSize / 2;
  const diagOffset = 15; 

  // Adjusted coordinates for more spacing
  const nodeSolarY = 40;
  const nodeHomeY = 160; 
  const nodeBatteryX = 60; 
  const nodeGridX = 340; 
  const nodeEVX = 200;
  const nodeEVY = 280; 
  const centerX = 200;


  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[400px] md:min-h-[500px] bg-background text-foreground">
      <CardHeader>
        <CardTitle className="flex items-center text-lg md:text-xl">
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Energy Flow
        </CardTitle>
      </CardHeader>
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
            </style>
          </defs>

          {/* Solar Icon and Labels */}
          <Sun x={centerX - iconOffset} y={nodeSolarY - iconOffset} className="h-10 w-10 text-yellow-500" /> {/* Increased size */}
          <text x={centerX} y={nodeSolarY + iconOffset + 10} textAnchor="middle" className="flow-text">{formatPowerForDisplay(solarGenerationWatts)}</text>
          <text x={centerX} y={nodeSolarY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">Solar</text>

          {/* Home Icon and Labels */}
          <Home x={centerX - iconOffset} y={nodeHomeY - iconOffset} className="h-10 w-10 text-primary" /> {/* Increased size */}
          <text x={centerX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{formatPowerForDisplay(homeConsumptionWatts)}</text>
          <text x={centerX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">Home</text>

          {/* Battery Icon and Labels */}
          <g transform={`translate(${nodeBatteryX - iconOffset}, ${nodeHomeY - iconOffset})`}>{getBatteryIconSized()}</g>
          <text x={nodeBatteryX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{batteryNodePowerText}</text>
          <text x={nodeBatteryX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>
          
          {/* Grid Icon and Labels */}
          <Power x={nodeGridX - iconOffset} y={nodeHomeY - iconOffset} className={cn("h-10 w-10", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground")} /> {/* Increased size */}
          <text x={nodeGridX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{gridNodePowerText}</text>
          <text x={nodeGridX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

          {/* EV Charger Icon and Labels */}
          <Car x={nodeEVX - iconOffset} y={nodeEVY - iconOffset} className={cn("h-10 w-10", evChargerPowerWatts > THRESHOLD_WATTS ? "text-green-500" : "text-muted-foreground")} /> {/* Increased size */}
          <text x={nodeEVX} y={nodeEVY + iconOffset + 10} textAnchor="middle" className="flow-text">{evNodePowerText}</text>
          <text x={nodeEVX} y={nodeEVY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">EV ({evCharger.rawStatus || 'N/A'})</text>

          {/* --- Lines and Flow Text --- */}
          {/* Solar to Home */}
          {isSolarToHome && (<>
            <path d={`M ${centerX} ${nodeSolarY + iconOffset} L ${centerX} ${nodeHomeY - iconOffset}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX + 20} y={(nodeSolarY + nodeHomeY) / 2} className="flow-text">{formatPowerForDisplay(solarToHomeW)}</text>
          </>)}

          {/* Solar to Battery */}
          {isSolarToBattery && (<>
            <path d={`M ${centerX - diagOffset - 5} ${nodeSolarY + diagOffset + 5} Q ${centerX - 90} ${(nodeSolarY + nodeHomeY) / 2}, ${nodeBatteryX + iconOffset} ${nodeHomeY - diagOffset - 5}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX - 80} y={(nodeSolarY + nodeHomeY) / 2 - 15} className="flow-text">{formatPowerForDisplay(solarToBatteryW)}</text>
          </>)}

          {/* Solar to Grid */}
          {isSolarToGrid && (<>
            <path d={`M ${centerX + diagOffset + 5} ${nodeSolarY + diagOffset + 5} Q ${centerX + 90} ${(nodeSolarY + nodeHomeY) / 2}, ${nodeGridX - iconOffset} ${nodeHomeY - diagOffset - 5}`} className="stroke-blue-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-blue)" />
            <text x={centerX + 80} y={(nodeSolarY + nodeHomeY) / 2 - 15} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>
          </>)}
          
          {/* Solar to EV Charger */}
          {isEvChargingFromSolar && (<>
            <path d={`M ${centerX} ${nodeSolarY + iconOffset + 5} L ${centerX} ${nodeEVY - iconOffset}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX - 20} y={(nodeSolarY + nodeEVY) / 2 + 20} className="flow-text">{formatPowerForDisplay(evChargingFromSolarW)}</text>
          </>)}


          {/* Grid to Home */}
          {isGridToHome && (<>
            <path d={`M ${nodeGridX - iconOffset} ${nodeHomeY} L ${centerX + iconOffset} ${nodeHomeY}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(centerX + nodeGridX) / 2} y={nodeHomeY - 8} className="flow-text">{formatPowerForDisplay(gridToHomeW)}</text>
          </>)}

          {/* Grid to Battery */}
          {isGridToBattery && (<>
            <path d={`M ${nodeGridX - diagOffset - 5} ${nodeHomeY - diagOffset - 5} Q ${(nodeGridX + nodeBatteryX) / 2} ${nodeHomeY - 80}, ${nodeBatteryX + diagOffset + 5} ${nodeHomeY - diagOffset - 5}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(nodeGridX + nodeBatteryX) / 2} y={nodeHomeY - 60} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>
          </>)}

          {/* Grid to EV Charger */}
          {isEvChargingFromGrid && (<>
            <path d={`M ${nodeGridX - diagOffset} ${nodeHomeY + iconOffset - diagOffset*2} Q ${(nodeGridX + nodeEVX)/2 + 30} ${(nodeHomeY + nodeEVY)/2 + 40}, ${nodeEVX + diagOffset} ${nodeEVY - iconOffset}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(nodeGridX + nodeEVX)/2 + 35} y={(nodeHomeY + nodeEVY)/2 + 50} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>
          </>)}


          {/* Battery to Home */}
          {isBatteryToHome && (<>
            <path d={`M ${nodeBatteryX + iconOffset} ${nodeHomeY} L ${centerX - iconOffset} ${nodeHomeY}`} className="stroke-orange-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />
            <text x={(centerX + nodeBatteryX) / 2} y={nodeHomeY - 8} className="flow-text">{formatPowerForDisplay(batteryToHomeW)}</text>
          </>)}
          
          {/* Battery to Grid */}
          {isBatteryToGrid && (<>
             <path d={`M ${nodeBatteryX + diagOffset + 5} ${nodeHomeY + diagOffset + 5} Q ${(nodeBatteryX + nodeGridX) / 2} ${nodeHomeY + 80}, ${nodeGridX - diagOffset - 5} ${nodeHomeY + diagOffset + 5}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={(nodeBatteryX + nodeGridX) / 2} y={nodeHomeY + 60} className="flow-text">{formatPowerForDisplay(batteryToGridW)}</text>
          </>)}

          {/* Battery to EV Charger */}
          {isEvChargingFromBattery && (<>
            <path d={`M ${nodeBatteryX + diagOffset} ${nodeHomeY + iconOffset - diagOffset*2} Q ${(nodeBatteryX + nodeEVX)/2 - 30} ${(nodeHomeY + nodeEVY)/2 + 40}, ${nodeEVX - diagOffset} ${nodeEVY - iconOffset}`} className="stroke-orange-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />
            <text x={(nodeBatteryX + nodeEVX)/2 - 35} y={(nodeHomeY + nodeEVY)/2 + 50} className="flow-text">{formatPowerForDisplay(evChargingFromBatteryW)}</text>
          </>)}

        </svg>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 max-w-xs"> {/* Centered and wider */}
          <div className="flex items-center mb-1">
            {getBatteryIconSized("h-6 w-6 flex-shrink-0")} {/* Adjusted progress bar icon size */}
            <span className="ml-2 text-sm font-semibold text-foreground">
              Battery: {battery.percentage}%
            </span>
          </div>
          <Progress value={battery.percentage} className="w-full h-2" /> {/* Slightly thicker progress bar */}
        </div>
      </CardContent>
    </Card>
  );
}
