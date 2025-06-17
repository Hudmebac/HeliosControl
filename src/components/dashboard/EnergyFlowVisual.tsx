
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

interface EnergyFlowVisualProps {
  data: RealTimeData | null;
}
interface EvCharger { value: number; unit: string; status?: string | { props: { children: string } }; 'Today\'s Energy'?: number | string; 'Session Energy'?: number | string; 'Current Charge'?: number | string; }
const THRESHOLD_WATTS = 5;

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
    evCharger: rawEvCharger,
    battery,
    rawGridPowerWatts,
  } = data;

  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit);

  let evChargerPowerWatts = 0;
  const evCharger = rawEvCharger as EvCharger | undefined;
  if (evCharger && typeof evCharger.value === 'number' && typeof evCharger.unit === 'string') {
    evChargerPowerWatts = getWatts(evCharger.value, evCharger.unit);
  }

  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_WATTS;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_WATTS;
  const batteryAbsPowerW = Math.abs(effectiveBatteryPowerWatts);

  const gridIsImporting = rawGridPowerWatts < -THRESHOLD_WATTS;
  const gridIsExporting = rawGridPowerWatts > THRESHOLD_WATTS;

  const isEVCharging = evChargerPowerWatts > THRESHOLD_WATTS;
  const isEVAvailable = evCharger !== undefined;

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
  const evNodePowerText = isEVCharging ? formatPowerForDisplay(evChargerPowerWatts) : (isEVAvailable ? "Idle" : "N/A");

  const solarPos = { x: 200, y: 30 };
  const homePos = { x: 200, y: 125 };
  const batteryPos = { x: 75, y: 125 };
  const gridPos = { x: 325, y: 125 };
  const evPos = { x: 200, y: 220 };

  const offset = 16;
  const diagOffset = 12;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[300px] md:min-h-[450px]">
      <CardHeader>
        <CardTitle className="flex items-center text-lg md:text-xl">
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Energy Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center p-4 md:p-6">
        <svg viewBox="0 0 400 300" className="w-full h-auto max-w-lg">
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

          {isSolarToHome && (<line x1={solarPos.x} y1={solarPos.y + offset} x2={homePos.x} y2={homePos.y - offset} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToHome && (<text x={(solarPos.x + homePos.x) / 2} y={(solarPos.y + offset + homePos.y - offset) / 2 - 3} className="flow-text">{formatPowerForDisplay(solarToHomeW)}</text>)}

					{isSolarToBattery && (<line x1={solarPos.x - diagOffset} y1={solarPos.y + diagOffset} x2={batteryPos.x + diagOffset} y2={batteryPos.y - diagOffset} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToBattery && (<text x={(solarPos.x - diagOffset + batteryPos.x + diagOffset) / 2 - 8} y={(solarPos.y + diagOffset + batteryPos.y - diagOffset) / 2 - 3} className="flow-text">{formatPowerForDisplay(solarToBatteryW)}</text>)}

					{isSolarToGrid && (<line x1={solarPos.x + diagOffset} y1={solarPos.y + diagOffset} x2={gridPos.x - diagOffset} y2={gridPos.y - diagOffset} className="stroke-blue-500" strokeWidth="1.5" markerEnd="url(#arrowhead-blue)" />)}
					{isSolarToGrid && (<text x={(solarPos.x + diagOffset + gridPos.x - diagOffset) / 2 + 8} y={(solarPos.y + diagOffset + gridPos.y - diagOffset) / 2 - 3} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>)}

					{isEVChargingFromSolar && isEVCharging && (<line x1={solarPos.x} y1={solarPos.y + offset} x2={evPos.x} y2={evPos.y - offset} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-solar-ev)" />)}
					{isEVChargingFromSolar && isEVAvailable && (<text x={(solarPos.x + evPos.x) / 2} y={(solarPos.y + offset + evPos.y - offset) / 2 - 3} className="flow-text">{formatPowerForDisplay(evChargingFromSolarW)}</text>)}
          
					{isGridToHome && (<line x1={gridPos.x - offset} y1={gridPos.y} x2={homePos.x + offset} y2={homePos.y} className="stroke-red-500" strokeWidth="1.5" markerEnd="url(#arrowhead-red)" />)}
					{isGridToHome && (<text x={(gridPos.x - offset + homePos.x + offset) / 2} y={(gridPos.y + homePos.y) / 2 - 8} className="flow-text">{formatPowerForDisplay(gridToHomeW)}</text>)}

					{isGridToBattery && (<line x1={gridPos.x - diagOffset} y1={gridPos.y - diagOffset} x2={batteryPos.x + diagOffset} y2={batteryPos.y + diagOffset} className="stroke-red-500" strokeWidth="1.5" markerEnd="url(#arrowhead-red)" />)}
					{isGridToBattery && (<text x={(gridPos.x - diagOffset + batteryPos.x + diagOffset) / 2} y={(gridPos.y - diagOffset + batteryPos.y + diagOffset) / 2 + 8} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>)}

					{isEVChargingFromGrid && isEVCharging && (<line x1={gridPos.x - diagOffset} y1={gridPos.y + diagOffset} x2={evPos.x + diagOffset} y2={evPos.y - offset} className="stroke-red-500" strokeWidth="1.5" markerEnd="url(#arrowhead-grid-ev)" />)}
					{isEVChargingFromGrid && isEVAvailable && (<text x={(gridPos.x - diagOffset + evPos.x + diagOffset) / 2 + 8} y={(gridPos.y + diagOffset + evPos.y - offset) / 2} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>)}

					{isBatteryToHome && (<line x1={batteryPos.x + offset} y1={batteryPos.y} x2={homePos.x - offset} y2={homePos.y} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-green)" />)}
					{isBatteryToHome && (<text x={(batteryPos.x + offset + homePos.x - offset) / 2} y={(batteryPos.y + homePos.y) / 2 + 8} className="flow-text">{formatPowerForDisplay(batteryToHomeW)}</text>)}

					{isBatteryToGrid && (<line x1={batteryPos.x + diagOffset} y1={batteryPos.y - diagOffset} x2={gridPos.x - diagOffset} y2={gridPos.y + diagOffset} className="stroke-blue-500" strokeWidth="1.5" markerEnd="url(#arrowhead-blue)" />)}
					{isBatteryToGrid && (<text x={(batteryPos.x + diagOffset + gridPos.x - diagOffset) / 2} y={(batteryPos.y - diagOffset + gridPos.y + diagOffset) / 2 - 8} className="flow-text">{formatPowerForDisplay(batteryToGridW)}</text>)}

					{isEVChargingFromBattery && isEVCharging && (<line x1={batteryPos.x + diagOffset} y1={batteryPos.y + diagOffset} x2={evPos.x - diagOffset} y2={evPos.y - offset} className="stroke-orange-500" strokeWidth="1.5" markerEnd="url(#arrowhead-battery-ev)" />)}
					{isEVChargingFromBattery && isEVAvailable && (<text x={(batteryPos.x + diagOffset + evPos.x - diagOffset) / 2 - 8} y={(batteryPos.y + diagOffset + evPos.y - offset) / 2} className="flow-text">{formatPowerForDisplay(evChargingFromBatteryW)}</text>)}

          <g transform={`translate(${solarPos.x - 20}, ${solarPos.y - 20})`}><Sun className="h-10 w-10 text-yellow-500" /></g>
					<text x={solarPos.x} y={solarPos.y + 28} textAnchor="middle" className="fill-current text-sm font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text>

					<g transform={`translate(${gridPos.x - 20}, ${gridPos.y - 20})`}><Power className={cn("h-10 w-10", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} /></g>
					<text x={gridPos.x} y={gridPos.y + 28} textAnchor="middle" className="fill-current text-sm font-medium">{gridNodePowerText}</text>
					<text x={gridPos.x} y={gridPos.y + 42} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

					<g transform={`translate(${homePos.x - 20}, ${homePos.y - 20})`}><Home className="h-10 w-10 text-primary" /></g>
					<text x={homePos.x} y={homePos.y + 28} textAnchor="middle" className="fill-current text-sm font-medium">{formatPowerForDisplay(homeConsumptionWatts)}</text>

					<g transform={`translate(${batteryPos.x - 20}, ${batteryPos.y - 20})`}>{getBatteryIconSized("h-10 w-10")}</g>
					<text x={batteryPos.x} y={batteryPos.y + 28} textAnchor="middle" className="fill-current text-sm font-medium">{batteryNodePowerText}</text>
					<text x={batteryPos.x} y={batteryPos.y + 42} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>
          
					{isEVAvailable && (
						<g transform={`translate(${evPos.x - 20}, ${evPos.y - 20})`}>
							{isEVCharging ? (<Bolt className="h-10 w-10 text-green-500" />) : (<Car className="h-10 w-10 text-muted-foreground" />)}
						</g>
					)}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + 28} textAnchor="middle" className="fill-current text-sm font-medium">{evNodePowerText}</text>)}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + 42} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{isEVCharging ? (evCharger?.status ? (typeof evCharger.status === 'string' ? evCharger.status : (evCharger.status as any).props.children) : 'Charging') : 'Idle'}</text>)}
				</svg>

				<div className="mt-auto pt-4 w-full max-w-xs">
					<div className="flex items-center mb-1">
            {getBatteryIconSized("h-8 w-8")}
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
