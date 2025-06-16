
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
import { cn } from "@/lib/utils";

interface EnergyFlowVisualProps {
  data: RealTimeData | null;
}

const THRESHOLD_WATTS = 50; // 50W threshold to show a flow

// Helper function to convert metric value to Watts
const getWatts = (value: number | string, unit: string): number => {
  if (typeof value !== 'number') return 0;
  return unit === 'kW' ? value * 1000 : value;
};

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

  const formatPowerForDisplay = (valueInWatts: number | string): string => {
    let watts: number;
    if (typeof valueInWatts === 'string') {
      watts = parseFloat(valueInWatts);
      if (isNaN(watts)) return "N/A"; 
    } else {
      watts = valueInWatts;
    }

    const absWatts = Math.abs(watts);

    if (absWatts < 1000) {
      const roundedWatts = Math.round(watts);
      return `${roundedWatts} W`;
    } else {
      const kW = watts / 1000;
      return `${kW.toFixed(2)} kW`;
    }
  };


  const {
    solarGeneration,
    homeConsumption,
    grid,
    evCharger,
    battery,
    rawGridPowerWatts, // Use this for grid direction
  } = data;
  
  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  // Convert all primary power figures to Watts for consistent internal logic
  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit); // This is already absolute from givenergy.ts formatPower

  let evChargerPowerWatts = 0;
  if (evCharger && typeof evCharger.value === 'number') {
    evChargerPowerWatts = getWatts(evCharger.value, evCharger.unit);
  }


  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_WATTS;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_WATTS;
  const batteryAbsPowerW = Math.abs(effectiveBatteryPowerWatts);

  // Use rawGridPowerWatts for determining import/export direction with threshold
  const gridIsImporting = rawGridPowerWatts < -THRESHOLD_WATTS;
  const gridIsExporting = rawGridPowerWatts > THRESHOLD_WATTS;
  
  const isEVCharging = evChargerPowerWatts > THRESHOLD_WATTS && (evCharger?.status?.props?.children === 'Charging' || (typeof evCharger?.status === 'string' && evCharger.status.toLowerCase().includes('charging')));
  const isEVAvailable = evCharger && evCharger.status?.props?.children !== 'Unavailable' && (typeof evCharger.status !== 'string' || !evCharger.status.toLowerCase().includes('unavailable'));


  // Determine active flows in Watts
  const solarToHomeW = Math.min(solarGenerationWatts, homeConsumptionWatts);
  const isSolarToHome = solarToHomeW > THRESHOLD_WATTS;

  // Grid contribution to home, considering solar already supplied to home
  const remainingHomeDemandAfterSolarW = Math.max(0, homeConsumptionWatts - solarToHomeW);
  const gridToHomeW = gridIsImporting ? Math.min(Math.abs(rawGridPowerWatts), remainingHomeDemandAfterSolarW) : 0;
  const isGridToHome = gridToHomeW > THRESHOLD_WATTS;

  // EV Charging sources in Watts
  const solarAvailableForEVOrBatteryW = Math.max(0, solarGenerationWatts - solarToHomeW);
  const evChargingFromSolarW = isEVCharging ? Math.min(solarAvailableForEVOrBatteryW, evChargerPowerWatts) : 0;
  const isEVChargingFromSolar = evChargingFromSolarW > THRESHOLD_WATTS;
  
  let remainingEVNeedsW = Math.max(0, evChargerPowerWatts - evChargingFromSolarW);
  const gridAvailableForEVOrBatteryW = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW) : 0;
  const evChargingFromGridW = isEVCharging ? Math.min(gridAvailableForEVOrBatteryW, remainingEVNeedsW) : 0;
  const isEVChargingFromGrid = evChargingFromGridW > THRESHOLD_WATTS;

  remainingEVNeedsW = Math.max(0, remainingEVNeedsW - evChargingFromGridW);
  const batteryDischargeAvailableForEVOrGridW = batteryIsDischarging ? batteryAbsPowerW : 0; // Simplified: total discharge available
  const evChargingFromBatteryW = isEVCharging ? Math.min(batteryDischargeAvailableForEVOrGridW, remainingEVNeedsW) : 0;
  const isEVChargingFromBattery = evChargingFromBatteryW > THRESHOLD_WATTS;

  // Recalculate Battery flows considering EV priority (simplified)
  // Battery to Home: what's left of home demand after solar and grid, met by battery (if discharging and not all going to EV)
  const homeDemandAfterSolarAndGridW = Math.max(0, homeConsumptionWatts - solarToHomeW - gridToHomeW);
  const batteryPowerForHomeOrGridW = Math.max(0, batteryAbsPowerW - evChargingFromBatteryW);
  const batteryToHomeW = batteryIsDischarging ? Math.min(batteryPowerForHomeOrGridW, homeDemandAfterSolarAndGridW) : 0;
  const isBatteryToHome = batteryToHomeW > THRESHOLD_WATTS;  

  // Solar to Battery: what's left of solar after home and EV, going to battery (if charging)
  const solarRemainingAfterHomeAndEVW = Math.max(0, solarGenerationWatts - solarToHomeW - evChargingFromSolarW);
  const solarToBatteryW = batteryIsCharging ? Math.min(solarRemainingAfterHomeAndEVW, batteryAbsPowerW) : 0;
  const isSolarToBattery = solarToBatteryW > THRESHOLD_WATTS;

  // Grid to Battery: what's left of grid import after home and EV, going to battery (if charging)
  const gridRemainingAfterHomeAndEVW = gridIsImporting ? Math.max(0, Math.abs(rawGridPowerWatts) - gridToHomeW - evChargingFromGridW) : 0;
  const gridToBatteryW = batteryIsCharging ? Math.min(gridRemainingAfterHomeAndEVW, batteryAbsPowerW) : 0;
  const isGridToBattery = gridToBatteryW > THRESHOLD_WATTS;

  // Export flows in Watts
  // Solar to Grid: what's left of solar after home, EV, and battery charging
  const solarRemainingForGridExportW = Math.max(0, solarGenerationWatts - solarToHomeW - evChargingFromSolarW - solarToBatteryW);
  const solarToGridW = gridIsExporting ? Math.min(solarRemainingForGridExportW, Math.abs(rawGridPowerWatts)) : 0;
  const isSolarToGrid = solarToGridW > THRESHOLD_WATTS;

  // Battery to Grid: what's left of battery discharge after home and EV
  const batteryRemainingForGridExportW = Math.max(0, batteryAbsPowerW - batteryToHomeW - evChargingFromBatteryW);
  const batteryToGridW = gridIsExporting ? Math.min(batteryRemainingForGridExportW, Math.abs(rawGridPowerWatts)) : 0;
  const isBatteryToGrid = batteryToGridW > THRESHOLD_WATTS;


  const getBatteryIcon = () => {
    if (batteryIsCharging) return <BatteryCharging className="h-8 w-8 text-blue-500" />;
    if (battery.percentage > 80) return <BatteryFull className="h-8 w-8 text-green-500" />;
    if (battery.percentage > 40) return <BatteryMedium className="h-8 w-8 text-yellow-500" />;
    if (battery.percentage > 10) return <BatteryLow className="h-8 w-8 text-orange-500" />;
    return <BatteryWarning className="h-8 w-8 text-red-600" />;
  };
  
  const batteryNodePowerText = batteryIsCharging || batteryIsDischarging ? formatPowerForDisplay(batteryAbsPowerW) : "0 W";
  const gridNodePowerText = gridIsImporting || gridIsExporting ? formatPowerForDisplay(gridDisplayValueWatts) : "0 W"; // gridDisplayValueWatts is already absolute
  const evNodePowerText = isEVAvailable ? formatPowerForDisplay(evChargerPowerWatts) : "N/A";


  const solarPos = { x: 175, y: 30, iconYAdjust: 1, textYAdjust: 20 };
  const homePos = { x: 175, y: 125, iconYAdjust: 1, textYAdjust: 20 };
  const batteryPos = { x: 50, y: homePos.y, iconYAdjust: 1, textYAdjust: 20 };
  const gridPos = { x: 275, y: homePos.y, iconYAdjust: 1, textYAdjust: 20 };
  const evPos = { x: 175, y: 200, iconYAdjust: 1, textYAdjust: 20 }; 

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

					{/* Icons and Text */}
					<g transform={`translate(${solarPos.x - 16}, ${solarPos.y + solarPos.iconYAdjust - 16})`}><Sun className="h-8 w-8 text-yellow-500" /></g>
					<text x={solarPos.x} y={solarPos.y + solarPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text>

					<g transform={`translate(${gridPos.x - 16}, ${gridPos.y + gridPos.iconYAdjust - 16})`}><Power className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} /></g>
					<text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{gridNodePowerText}</text> 
					<text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text> 

					<g transform={`translate(${homePos.x - 16}, ${homePos.y + homePos.iconYAdjust - 16})`}><Home className="h-8 w-8 text-primary" /></g>
					<text x={homePos.x} y={homePos.y + homePos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(homeConsumptionWatts)}</text>

					<g transform={`translate(${batteryPos.x - 16}, ${batteryPos.y + batteryPos.iconYAdjust - 16})`}>{getBatteryIcon()}</g>
					<text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{batteryNodePowerText}</text>
					<text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text> 
					
					{isEVAvailable && evCharger && (
						<g transform={`translate(${evPos.x - 16}, ${evPos.y + evPos.iconYAdjust - 16})`}><Car className={cn("h-8 w-8", isEVCharging ? "text-green-500" : "text-muted-foreground")} /></g>
					)}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + evPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{evNodePowerText}</text>)}
				</svg>

				<div className="mt-auto pt-4 hidden"> 
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
