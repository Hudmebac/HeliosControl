
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
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  useMotionValue,
  motion,
  AnimatePresence,
  useTransform,
  useMotionTemplate,
} from "framer-motion";

import { cn } from "@/lib/utils";

interface EnergyFlowVisualProps {
  data: RealTimeData | null;
}

const THRESHOLD_KW = 0.05; // 50W threshold to show a flow

export function EnergyFlowVisual({ data }: EnergyFlowVisualProps) {
  if (!data) {
    return (
      <Card className="h-full min-h-[300px] md:min-h-[400px] flex items-center justify-center shadow-lg">
        <CardContent>
          <p>Energy flow data unavailable.</p>
        </CardContent>
      </Card>
    );
  }

  const {
    solarGeneration,
    homeConsumption,
    grid,
 evCharger,
    battery,
  } = data;
  
  // Use effective battery power directly from data.battery.rawPowerWatts
  // This value is pre-calculated in givenergy.ts to be the most representative flow
  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  const solarKW = typeof solarGeneration.value === 'number' ? solarGeneration.value : 0;
  const homeKW = typeof homeConsumption.value === 'number' ? homeConsumption.value : 0;
  
  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_KW * 1000;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_KW * 1000;
  const batteryAbsPowerKW = Math.abs(effectiveBatteryPowerWatts) / 1000;

  const gridPowerAbsKW = typeof grid.value === 'number' ? grid.value : 0;
  const gridIsImporting = grid.flow === "importing" && gridPowerAbsKW > THRESHOLD_KW;
  const gridIsExporting = grid.flow === "exporting" && gridPowerAbsKW > THRESHOLD_KW;
  
  // EV Charger data
  const evKW = typeof evCharger?.power === 'number' ? evCharger.power / 1000 : 0;
  const isEVCharging = (evCharger?.status === 'charging' || evCharger?.status === 'charge_complete') && evKW > THRESHOLD_KW;
  const isEVAvailable = evCharger && evCharger.status !== 'unavailable';
  const evNodePowerText = isEVCharging ? `${formatKW(evKW)} kW` : "0.00 kW";


  // Determine active flows
  const solarToHomeKW = Math.min(solarKW, homeKW);
  const isSolarToHome = solarToHomeKW > THRESHOLD_KW;

  const gridToHomeKW = gridIsImporting ? Math.min(gridPowerAbsKW, homeKW - solarToHomeKW) : 0;
  const isGridToHome = gridToHomeKW > THRESHOLD_KW;

  // Determine where EV power is coming from if charging
  const evChargingFromSolarKW = isEVCharging && solarKW > THRESHOLD_KW ? Math.min(solarKW - solarToHomeKW, evKW) : 0;
  const isEVChargingFromSolar = evChargingFromSolarKW > THRESHOLD_KW;

  const remainingEVNeedsKW = evKW - evChargingFromSolarKW;

  const evChargingFromGridKW = isEVCharging && gridIsImporting ? Math.min(gridPowerAbsKW, remainingEVNeedsKW) : 0;
  const isEVChargingFromGrid = evChargingFromGridKW > THRESHOLD_KW;

  const evChargingFromBatteryKW = isEVCharging && batteryIsDischarging ? Math.min(batteryAbsPowerKW, remainingEVNeedsKW - evChargingFromGridKW) : 0;
  const isEVChargingFromBattery = evChargingFromBatteryKW > THRESHOLD_KW;

  // Recalculate Home, Battery, Grid flows considering EV
  const batteryToHomeKW = batteryIsDischarging ? Math.min(batteryAbsPowerKW - evChargingFromBatteryKW, homeKW - solarToHomeKW - gridToHomeKW) : 0;
  const isBatteryToHome = batteryToHomeKW > THRESHOLD_KW;  

  const solarToBatteryKW = batteryIsCharging && solarKW > THRESHOLD_KW && !gridIsImporting && !isEVChargingFromSolar ? Math.min(solarKW - solarToHomeKW - evChargingFromSolarKW, batteryAbsPowerKW) : 0;
  const isSolarToBattery = solarToBatteryKW > THRESHOLD_KW;

  const gridToBatteryKW = batteryIsCharging && gridIsImporting && !isEVChargingFromGrid ? Math.min(gridPowerAbsKW - evChargingFromGridKW, batteryAbsPowerKW) : 0;
  const isGridToBattery = gridToBatteryKW > THRESHOLD_KW;

  const solarToGridKW = gridIsExporting && solarKW > THRESHOLD_KW && !batteryIsDischarging && !isEVChargingFromSolar ? Math.min(solarKW - solarToHomeKW - solarToBatteryKW - evChargingFromSolarKW, gridPowerAbsKW) : 0;
  const isSolarToGrid = solarToGridKW > THRESHOLD_KW;

  const batteryToGridKW = gridIsExporting && batteryIsDischarging ? Math.min(batteryAbsPowerKW - batteryToHomeKW, gridPowerAbsKW) : 0;
  const isBatteryToGrid = batteryToGridKW > THRESHOLD_KW;


  const formatKW = (value: number | string) => {
    if (typeof value === 'string') return value;
    if (value < 0.01 && value > -0.01) return "0.00"; // Avoid -0.00
    return value.toFixed(2);
  };

  const getBatteryIcon = () => {
    if (batteryIsCharging) return <BatteryCharging className="h-8 w-8 text-blue-500" />;
    if (battery.percentage > 80) return <BatteryFull className="h-8 w-8 text-green-500" />;
    if (battery.percentage > 40) return <BatteryMedium className="h-8 w-8 text-yellow-500" />;
    if (battery.percentage > 10) return <BatteryLow className="h-8 w-8 text-orange-500" />;
    return <BatteryWarning className="h-8 w-8 text-red-600" />;
  };
  
  const batteryNodePowerText = batteryIsCharging || batteryIsDischarging ? `${formatKW(batteryAbsPowerKW)} kW` : "0.00 kW";
  const gridNodePowerText = gridIsImporting || gridIsExporting ? `${formatKW(gridPowerAbsKW)} kW` : "0.00 kW";

  const solarPos = { x: 175, y: 30, iconYAdjust: 1, textYAdjust: 20 };
  const homePos = { x: 175, y: 125, iconYAdjust: 1, textYAdjust: 20 };
  const batteryPos = { x: 50, y: homePos.y, iconYAdjust: 1, textYAdjust: 20 };
  const gridPos = { x: 275, y: homePos.y, iconYAdjust: 1, textYAdjust: 20 };
  const evPos = { x: 175, y: 200, iconYAdjust: 1, textYAdjust: 20 }; // Moved below Home icon

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[300px] md:min-h-[400px]">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Energy Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center">
        <svg viewBox="0 0 400 280" className="w-full h-auto">
					<defs>
						<marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 8 3, 0 6" /></marker>
						<marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 8 3, 0 6" /></marker>
						<marker id="arrowhead-orange" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 8 3, 0 6" /></marker>
						<marker id="arrowhead-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" fill="var(--color-blue-500, #3B82F6)"><polygon points="0 0, 8 3, 0 6" /></marker>
					</defs>

					<style>
						{`
							@keyframes flow-animation {
								to {
									stroke-dashoffset: -1000;
								}
							}

							.flow-line {
								stroke-dasharray: 100;
								animation: flow-animation 5s linear infinite;
							}
						`}
					</style>

					{/* Lines */}
					{isSolarToHome && (<line x1={solarPos.x} y1={solarPos.y + 16} x2={homePos.x} y2={homePos.y - 16} className="stroke-green-500" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToBattery && (<line x1={solarPos.x + 16} y1={solarPos.y + 16} x2={batteryPos.x} y2={batteryPos.y - 16} className="stroke-green-500" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToGrid && (<line x1={solarPos.x - 16} y1={solarPos.y + 16} x2={gridPos.x} y2={gridPos.y - 16} className="stroke-blue-500" strokeWidth="2.5" markerEnd="url(#arrowhead-blue)" />)}
					{isEVChargingFromSolar && isEVAvailable && (<line x1={solarPos.x} y1={solarPos.y + 16} x2={evPos.x} y2={evPos.y - 16} className="stroke-green-500" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />)}

					{isGridToHome && (<line x1={gridPos.x - 16} y1={gridPos.y} x2={homePos.x + 16} y2={homePos.y} className="stroke-red-500" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />)}
					{isGridToBattery && (<line x1={gridPos.x - 16} y1={gridPos.y} x2={batteryPos.x + 16} y2={batteryPos.y} className="stroke-red-500" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />)}
					{isEVChargingFromGrid && isEVAvailable && (<line x1={gridPos.x} y1={gridPos.y + 16} x2={evPos.x} y2={evPos.y - 16} className="stroke-red-500" strokeWidth="2.5" markerEnd="url(#arrowhead-red)" />)}

					{isBatteryToHome && (<line x1={batteryPos.x + 16} y1={batteryPos.y} x2={homePos.x - 16} y2={homePos.y} className="stroke-green-500" strokeWidth="2.5" markerEnd="url(#arrowhead-green)" />)}
					{isBatteryToGrid && (<line x1={batteryPos.x + 16} y1={batteryPos.y} x2={gridPos.x - 16} y2={gridPos.y} className="stroke-blue-500" strokeWidth="2.5" markerEnd="url(#arrowhead-blue)" />)}
					{isEVChargingFromBattery && isEVAvailable && (<line x1={batteryPos.x} y1={batteryPos.y + 16} x2={evPos.x} y2={evPos.y - 16} className="stroke-orange-500" strokeWidth="2.5" markerEnd="url(#arrowhead-orange)" />)}

					{/* Home to EV - Only if EV is charging and power is coming from Home (implicitly via Battery/Grid). Adjust y1 to be homePos.y + 16 and y2 to be evPos.y - 16 for consistency */}
					{/* {isEVCharging && !isEVChargingFromSolar && !isEVChargingFromGrid && !isEVChargingFromBattery && isEVAvailable && (
						<line x1={homePos.x} y1={homePos.y + 16} x2={evPos.x} y2={evPos.y - 16} className="stroke-primary" strokeWidth="2.5" markerEnd="url(#arrowhead-blue)" />
					)} */}

					{/* Icons and Text */}
					<g transform={`translate(${solarPos.x - 16}, ${solarPos.y + solarPos.iconYAdjust - 16})`}><Sun className="h-8 w-8 text-yellow-500" /></g>
					<text x={solarPos.x} y={solarPos.y + solarPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{formatKW(solarKW)} kW</text>

					<g transform={`translate(${gridPos.x - 16}, ${gridPos.y + gridPos.iconYAdjust - 16})`}><Power className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} /></g>
					<text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{gridNodePowerText}</text> {/* Adjusted text position */}
					<text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text> {/* Adjusted text position */}

					<g transform={`translate(${homePos.x - 16}, ${homePos.y + homePos.iconYAdjust - 16})`}><Home className="h-8 w-8 text-primary" /></g>
					<text x={homePos.x} y={homePos.y + homePos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{formatKW(homeKW)} kW</text>

					<g transform={`translate(${batteryPos.x - 16}, ${batteryPos.y + batteryPos.iconYAdjust - 16})`}>{getBatteryIcon()}</g>
					<text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{batteryNodePowerText}</text>
					<text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text> {/* Adjusted text position */}
					
					{isEVAvailable && evCharger && (
						<g transform={`translate(${evPos.x - 16}, ${evPos.y + evPos.iconYAdjust - 16})`}><Car className={cn("h-8 w-8", isEVCharging ? "text-green-500" : "text-muted-foreground")} /></g>
					)}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + evPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{evNodePowerText}</text>)}
				</svg>

				<div className="mt-auto pt-4 hidden"> {/* Temporarily hide battery progress bar */}
					<div className="flex items-center mb-1">
						{getBatteryIcon()}
						<span className="ml-2 text-sm font-semibold text-foreground">
							Battery Charge: {battery.percentage}%
						</span>
					</div>
					<Progress value={battery.percentage} className="w-full h-3" />
				</div>
      </CardContent>
    </Card>
  );
}

