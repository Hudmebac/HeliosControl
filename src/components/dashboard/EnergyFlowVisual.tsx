
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

  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit);

  let evChargerPowerWatts = 0;
  if (evCharger && typeof evCharger.value === 'number' && typeof evCharger.unit === 'string') {
    evChargerPowerWatts = getWatts(evCharger.value, evCharger.unit);
  }

  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_WATTS;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_WATTS;
  const batteryAbsPowerW = Math.abs(effectiveBatteryPowerWatts);

  const gridIsImporting = rawGridPowerWatts < -THRESHOLD_WATTS;
  const gridIsExporting = rawGridPowerWatts > THRESHOLD_WATTS;

  const isEVCharging = evChargerPowerWatts > THRESHOLD_WATTS;
  const isEVAvailable = evCharger !== undefined && evCharger.rawStatus !== "unavailable";


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

  const offset = 16; // Half of icon size (32px)
  const diagOffset = 12; // Adjusted for diagonal connections

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

          {/* Solar to Home */}
          {isSolarToHome && (<line x1={solarPos.x} y1={solarPos.y + offset} x2={homePos.x} y2={homePos.y - offset} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToHome && (<text x={(solarPos.x + homePos.x) / 2} y={(solarPos.y + offset + homePos.y - offset) / 2 - 5} className="flow-text">{formatPowerForDisplay(solarToHomeW)}</text>)}

          {/* Solar to Battery */}
					{isSolarToBattery && (<line x1={solarPos.x - diagOffset} y1={solarPos.y + diagOffset} x2={batteryPos.x + diagOffset} y2={batteryPos.y - diagOffset} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToBattery && (<text x={(solarPos.x - diagOffset + batteryPos.x + diagOffset) / 2 - 8} y={(solarPos.y + diagOffset + batteryPos.y - diagOffset) / 2 - 3} className="flow-text">{formatPowerForDisplay(solarToBatteryW)}</text>)}

          {/* Solar to Grid */}
					{isSolarToGrid && (<line x1={solarPos.x + diagOffset} y1={solarPos.y + diagOffset} x2={gridPos.x - diagOffset} y2={gridPos.y - diagOffset} className="stroke-blue-500" strokeWidth="1.5" markerEnd="url(#arrowhead-blue)" />)}
					{isSolarToGrid && (<text x={(solarPos.x + diagOffset + gridPos.x - diagOffset) / 2 + 8} y={(solarPos.y + diagOffset + gridPos.y - diagOffset) / 2 - 3} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>)}

          {/* Solar to EV */}
					{isEVChargingFromSolar && isEVCharging && (<line x1={solarPos.x} y1={solarPos.y + offset} x2={evPos.x} y2={evPos.y - offset} className="stroke-green-500" strokeWidth="1.5" markerEnd="url(#arrowhead-solar-ev)" />)}
					{isEVChargingFromSolar && isEVAvailable && (<text x={(solarPos.x + evPos.x) / 2 + 5 } y={(solarPos.y + offset + evPos.y - offset) / 2 } className="flow-text">{formatPowerForDisplay(evChargingFromSolarW)}</text>)}
          
          {/* Grid to Home */}
					{isGridToHome && (<line x1={gridPos.x - offset} y1={gridPos.y} x2={homePos.x + offset} y2={homePos.y} className="stroke-red-500" strokeWidth="1.5" markerEnd="url(#arrowhead-red)" />)}
					{isGridToHome && (<text x={(gridPos.x - offset + homePos.x + offset) / 2 + 5} y={(gridPos.y + homePos.y) / 2} className="flow-text">{formatPowerForDisplay(gridToHomeW)}</text>)}

          {/* Grid to Battery */}
					{isGridToBattery && (<line x1={gridPos.x} y1={gridPos.y - offset} x2={batteryPos.x} y2={batteryPos.y + offset} className="stroke-red-500" strokeWidth="1.5" markerEnd="url(#arrowhead-red)" />)}
					{isGridToBattery && (<text x={(gridPos.x + batteryPos.x) / 2} y={(gridPos.y - offset + batteryPos.y + offset) / 2 + 5} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>)}

          {/* Grid to EV */}
					{isEVChargingFromGrid && isEVCharging && (<line x1={gridPos.x - diagOffset} y1={gridPos.y + diagOffset} x2={evPos.x + diagOffset} y2={evPos.y - diagOffset} className="stroke-red-500" strokeWidth="1.5" markerEnd="url(#arrowhead-grid-ev)" />)}
					{isEVChargingFromGrid && isEVAvailable && (<text x={(gridPos.x - diagOffset + evPos.x + diagOffset) / 2 + 8} y={(gridPos.y + diagOffset + evPos.y - diagOffset) / 2 + 3} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>)}

          {/* Battery to Home */}
					{isBatteryToHome && (<line x1={batteryPos.x + offset} y1={batteryPos.y} x2={homePos.x - offset} y2={homePos.y} className="stroke-orange-500" strokeWidth="1.5" markerEnd="url(#arrowhead-orange)" />)}
					{isBatteryToHome && (<text x={(batteryPos.x + offset + homePos.x - offset) / 2 - 5} y={(batteryPos.y + homePos.y) / 2} className="flow-text">{formatPowerForDisplay(batteryToHomeW)}</text>)}

          {/* Battery to Grid */}
					{isBatteryToGrid && (<line x1={batteryPos.x + diagOffset} y1={batteryPos.y - diagOffset} x2={gridPos.x - diagOffset} y2={gridPos.y + diagOffset} className="stroke-blue-500" strokeWidth="1.5" markerEnd="url(#arrowhead-blue)" />)}
					{isBatteryToGrid && (<text x={(batteryPos.x + diagOffset + gridPos.x - diagOffset) / 2} y={(batteryPos.y - diagOffset + gridPos.y + diagOffset) / 2 - 8} className="flow-text">{formatPowerForDisplay(batteryToGridW)}</text>)}
          
          {/* Battery to EV */}
					{isEVChargingFromBattery && isEVCharging && (<line x1={batteryPos.x + diagOffset} y1={batteryPos.y + diagOffset} x2={evPos.x - diagOffset} y2={evPos.y - diagOffset} className="stroke-orange-500" strokeWidth="1.5" markerEnd="url(#arrowhead-battery-ev)" />)}
					{isEVChargingFromBattery && isEVAvailable && (<text x={(batteryPos.x + diagOffset + evPos.x - diagOffset) / 2 - 8} y={(batteryPos.y + diagOffset + evPos.y - diagOffset) / 2 + 3} className="flow-text">{formatPowerForDisplay(evChargingFromBatteryW)}</text>)}

          {/* Icons and Labels */}
          <g transform={`translate(${solarPos.x - 16}, ${solarPos.y - 16})`}><Sun className="h-8 w-8 text-yellow-500" /></g>
					<text x={solarPos.x} y={solarPos.y + 28} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text>

					<g transform={`translate(${gridPos.x - 16}, ${gridPos.y - 16})`}><Power className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} /></g>
					<text x={gridPos.x} y={gridPos.y + 28} textAnchor="middle" className="fill-current text-xs font-medium">{gridNodePowerText}</text>
					<text x={gridPos.x} y={gridPos.y + 40} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

					<g transform={`translate(${homePos.x - 16}, ${homePos.y - 16})`}><Home className="h-8 w-8 text-primary" /></g>
					<text x={homePos.x} y={homePos.y + 28} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(homeConsumptionWatts)}</text>

					<g transform={`translate(${batteryPos.x - 16}, ${batteryPos.y - 16})`}>{getBatteryIconSized("h-8 w-8")}</g>
					<text x={batteryPos.x} y={batteryPos.y + 28} textAnchor="middle" className="fill-current text-xs font-medium">{batteryNodePowerText}</text>
					<text x={batteryPos.x} y={batteryPos.y + 40} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>
          
					{isEVAvailable && (
						<g transform={`translate(${evPos.x - 16}, ${evPos.y - 16})`}>
							{isEVCharging ? (<Bolt className="h-8 w-8 text-green-500" />) : (<Car className="h-8 w-8 text-muted-foreground" />)}
						</g>
					)}
          {/* Use rawStatus for SVG text node */}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + 28} textAnchor="middle" className="fill-current text-xs font-medium">{evNodePowerText}</text>)}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + 40} textAnchor="middle" className="fill-current text-[10px] text-muted-foreground">{isEVCharging ? (evCharger?.rawStatus ? evCharger.rawStatus.charAt(0).toUpperCase() + evCharger.rawStatus.slice(1) : 'Charging') : 'Idle'}</text>)}
				</svg>

				<div className="mt-auto pt-4 w-full max-w-xs">
					<div className="flex items-center mb-1">
            {getBatteryIconSized("h-6 w-6")}
						<span className="ml-2 text-sm font-semibold text-foreground">
							Battery: {battery.percentage}%
						</span>
					</div>
					<Progress value={battery.percentage} className="w-full h-2.5" />
				</div>
      </CardContent>
    </Card>
  );
}

