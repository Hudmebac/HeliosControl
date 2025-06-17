
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
    rawGridPowerWatts, // Negative for import, positive for export
    rawSolarPowerWatts,
  } = data;

  // Use effectiveBatteryPowerWatts which is battery.rawPowerWatts (negative for charge, positive for discharge)
  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;
  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit); // This is Math.abs of rawGridPowerWatts essentially
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

  // EV charging from Solar (priority before battery charging or grid export from solar)
  let evChargingFromSolarW = 0;
  let isEvChargingFromSolar = false;
  if (evChargerPowerWatts > THRESHOLD_WATTS) {
    evChargingFromSolarW = Math.min(solarRemainingAfterHomeW, evChargerPowerWatts);
    isEvChargingFromSolar = evChargingFromSolarW > THRESHOLD_WATTS;
    solarRemainingAfterHomeW = Math.max(0, solarRemainingAfterHomeW - evChargingFromSolarW);
  }

  // Solar to Battery
  const solarToBatteryW = batteryIsCharging ? Math.min(solarRemainingAfterHomeW, batteryAbsPowerW) : 0;
  const isSolarToBattery = solarToBatteryW > THRESHOLD_WATTS;
  let solarRemainingAfterBatteryW = Math.max(0, solarRemainingAfterHomeW - solarToBatteryW);

  // Solar to Grid
  const solarToGridW = gridIsExporting ? Math.min(solarRemainingAfterBatteryW, Math.abs(rawGridPowerWatts)) : 0;
  const isSolarToGrid = solarToGridW > THRESHOLD_WATTS;


  // Home demand fulfillment
  let remainingHomeDemandAfterSolarW = Math.max(0, homeConsumptionWatts - solarToHomeW);
  
  // Grid to Home
  const gridToHomeW = (gridIsImporting && remainingHomeDemandAfterSolarW > THRESHOLD_WATTS) ? Math.min(Math.abs(rawGridPowerWatts), remainingHomeDemandAfterSolarW) : 0;
  const isGridToHome = gridToHomeW > THRESHOLD_WATTS;
  let remainingHomeDemandAfterSolarAndGridW = Math.max(0, remainingHomeDemandAfterSolarW - gridToHomeW);

  // Battery to Home
  const batteryToHomeW = (batteryIsDischarging && remainingHomeDemandAfterSolarAndGridW > THRESHOLD_WATTS) ? Math.min(batteryAbsPowerW, remainingHomeDemandAfterSolarAndGridW) : 0;
  const isBatteryToHome = batteryToHomeW > THRESHOLD_WATTS;

  // Power available from battery after supplying home
  let batteryPowerAvailableForGridOrEvW = batteryIsDischarging ? Math.max(0, batteryAbsPowerW - batteryToHomeW) : 0;

  // EV charging from Battery (if not fully covered by solar)
  let evChargingFromBatteryW = 0;
  let isEvChargingFromBattery = false;
  const evDemandNotMetBySolar = Math.max(0, evChargerPowerWatts - evChargingFromSolarW);
  if (evDemandNotMetBySolar > THRESHOLD_WATTS && batteryIsDischarging) {
    evChargingFromBatteryW = Math.min(batteryPowerAvailableForGridOrEvW, evDemandNotMetBySolar);
    isEvChargingFromBattery = evChargingFromBatteryW > THRESHOLD_WATTS;
    batteryPowerAvailableForGridOrEvW = Math.max(0, batteryPowerAvailableForGridOrEvW - evChargingFromBatteryW);
  }
  
  // Battery to Grid
  const gridExportDemandNotMetBySolar = gridIsExporting ? Math.max(0, Math.abs(rawGridPowerWatts) - solarToGridW) : 0;
  const batteryToGridW = (gridIsExporting && batteryIsDischarging && gridExportDemandNotMetBySolar > THRESHOLD_WATTS) ? Math.min(batteryPowerAvailableForGridOrEvW, gridExportDemandNotMetBySolar) : 0;
  const isBatteryToGrid = batteryToGridW > THRESHOLD_WATTS;

  // Power available from grid after supplying home
  let gridPowerAvailableForEvOrBatteryW = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW) : 0;
  
  // EV charging from Grid (if not fully covered by solar or battery)
  let evChargingFromGridW = 0;
  let isEvChargingFromGrid = false;
  const evDemandNotMetBySolarOrBattery = Math.max(0, evDemandNotMetBySolar - evChargingFromBatteryW);
  if (evDemandNotMetBySolarOrBattery > THRESHOLD_WATTS && gridIsImporting) {
    evChargingFromGridW = Math.min(gridPowerAvailableForEvOrBatteryW, evDemandNotMetBySolarOrBattery);
    isEvChargingFromGrid = evChargingFromGridW > THRESHOLD_WATTS;
    gridPowerAvailableForEvOrBatteryW = Math.max(0, gridPowerAvailableForEvOrBatteryW - evChargingFromGridW);
  }

  // Grid to Battery (if not fully charged by solar)
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

  const batteryNodePowerText = batteryIsCharging || batteryIsDischarging ? formatPowerForDisplay(batteryAbsPowerW) : "0 W";
  const gridNodePowerText = gridIsImporting || gridIsExporting ? formatPowerForDisplay(gridDisplayValueWatts) : "0 W";
  const evNodePowerText = evChargerPowerWatts > THRESHOLD_WATTS ? formatPowerForDisplay(evChargerPowerWatts) : "0 W";

  const iconSize = 32; 
  const iconOffset = iconSize / 2; // 16
  const diagOffset = 12; 

  const nodeSolarY = 30;
  const nodeHomeY = 125; 
  const nodeBatteryX = 75; 
  const nodeGridX = 325; 
  const nodeEVX = 200;
  const nodeEVY = 220; 
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
          <Sun x={centerX - iconOffset} y={nodeSolarY - iconOffset} className="h-8 w-8 text-yellow-500" />
          <text x={centerX} y={nodeSolarY + iconOffset + 10} textAnchor="middle" className="flow-text">{formatPowerForDisplay(solarGenerationWatts)}</text>
          <text x={centerX} y={nodeSolarY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">Solar</text>

          {/* Home Icon and Labels */}
          <Home x={centerX - iconOffset} y={nodeHomeY - iconOffset} className="h-8 w-8 text-primary" />
          <text x={centerX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{formatPowerForDisplay(homeConsumptionWatts)}</text>
          <text x={centerX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">Home</text>

          {/* Battery Icon and Labels */}
          <g transform={`translate(${nodeBatteryX - iconOffset}, ${nodeHomeY - iconOffset})`}>{getBatteryIconSized("h-8 w-8")}</g>
          <text x={nodeBatteryX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{batteryNodePowerText}</text>
          <text x={nodeBatteryX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>
          
          {/* Grid Icon and Labels */}
          <Power x={nodeGridX - iconOffset} y={nodeHomeY - iconOffset} className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground")} />
          <text x={nodeGridX} y={nodeHomeY + iconOffset + 10} textAnchor="middle" className="flow-text">{gridNodePowerText}</text>
          <text x={nodeGridX} y={nodeHomeY + iconOffset + 22} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

          {/* EV Charger Icon and Labels */}
          <Car x={nodeEVX - iconOffset} y={nodeEVY - iconOffset} className={cn("h-8 w-8", evChargerPowerWatts > THRESHOLD_WATTS ? "text-green-500" : "text-muted-foreground")} />
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
            <path d={`M ${centerX - diagOffset} ${nodeSolarY + iconOffset - diagOffset/2} Q ${centerX - 90} ${(nodeSolarY + nodeHomeY) / 2}, ${nodeBatteryX + iconOffset} ${nodeHomeY - diagOffset}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={centerX - 70} y={(nodeSolarY + nodeHomeY) / 2 - 20} className="flow-text">{formatPowerForDisplay(solarToBatteryW)}</text>
          </>)}

          {/* Solar to Grid */}
          {isSolarToGrid && (<>
            <path d={`M ${centerX + diagOffset} ${nodeSolarY + iconOffset - diagOffset/2} Q ${centerX + 90} ${(nodeSolarY + nodeHomeY) / 2}, ${nodeGridX - iconOffset} ${nodeHomeY - diagOffset}`} className="stroke-blue-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-blue)" />
            <text x={centerX + 70} y={(nodeSolarY + nodeHomeY) / 2 - 20} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>
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
            <path d={`M ${nodeGridX - iconOffset} ${nodeHomeY + diagOffset} Q ${(nodeGridX + nodeBatteryX) / 2 + 30} ${nodeHomeY + 70}, ${nodeBatteryX + iconOffset} ${nodeHomeY + diagOffset}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(nodeGridX + nodeBatteryX) / 2} y={nodeHomeY + 55} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>
          </>)}

          {/* Grid to EV Charger */}
          {isEvChargingFromGrid && (<>
            <path d={`M ${nodeGridX - diagOffset} ${nodeHomeY + iconOffset + diagOffset*2} Q ${(nodeGridX + nodeEVX)/2 + 30} ${(nodeHomeY + nodeEVY)/2 + 40}, ${nodeEVX + diagOffset} ${nodeEVY - iconOffset + 5}`} className="stroke-red-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />
            <text x={(nodeGridX + nodeEVX)/2 + 40} y={(nodeHomeY + nodeEVY)/2 + 55} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>
          </>)}


          {/* Battery to Home */}
          {isBatteryToHome && (<>
            <path d={`M ${nodeBatteryX + iconOffset} ${nodeHomeY} L ${centerX - iconOffset} ${nodeHomeY}`} className="stroke-orange-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />
            <text x={(centerX + nodeBatteryX) / 2} y={nodeHomeY - 8} className="flow-text">{formatPowerForDisplay(batteryToHomeW)}</text>
          </>)}
          
          {/* Battery to Grid */}
          {isBatteryToGrid && (<>
             <path d={`M ${nodeBatteryX + iconOffset} ${nodeHomeY - diagOffset} Q ${(nodeBatteryX + nodeGridX) / 2 - 30} ${nodeHomeY - 70}, ${nodeGridX - iconOffset} ${nodeHomeY - diagOffset}`} className="stroke-green-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />
            <text x={(nodeBatteryX + nodeGridX) / 2} y={nodeHomeY - 55} className="flow-text">{formatPowerForDisplay(batteryToGridW)}</text>
          </>)}

          {/* Battery to EV Charger */}
          {isEvChargingFromBattery && (<>
            <path d={`M ${nodeBatteryX + diagOffset} ${nodeHomeY + iconOffset + diagOffset*2} Q ${(nodeBatteryX + nodeEVX)/2 - 30} ${(nodeHomeY + nodeEVY)/2 + 40}, ${nodeEVX - diagOffset} ${nodeEVY - iconOffset + 5}`} className="stroke-orange-500 fill-none" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />
            <text x={(nodeBatteryX + nodeEVX)/2 - 40} y={(nodeHomeY + nodeEVY)/2 + 55} className="flow-text">{formatPowerForDisplay(evChargingFromBatteryW)}</text>
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

