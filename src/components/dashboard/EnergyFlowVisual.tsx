
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

const THRESHOLD_WATTS = 5; // Lowered from 50W to 5W

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
    rawGridPowerWatts, // Use this for grid direction
  } = data;

  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;

  // Convert all primary power figures to Watts for consistent internal logic
  const solarGenerationWatts = getWatts(solarGeneration.value, solarGeneration.unit);
  const homeConsumptionWatts = getWatts(homeConsumption.value, homeConsumption.unit);
  const gridDisplayValueWatts = getWatts(grid.value, grid.unit); // This value can be negative for import

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
  const gridNodePowerText = gridIsImporting || gridIsExporting ? formatPowerForDisplay(gridDisplayValueWatts) : "0 W";
  const evNodePowerText = isEVAvailable ? formatPowerForDisplay(evChargerPowerWatts) : "N/A";

  // Adjusted icon positions
  const solarPos = { x: 150, y: 36, iconYAdjust: 1.2, textYAdjust: 24 }; // Scaled by 1.2
  const homePos = { x: 150, y: 150, iconYAdjust: 1.2, textYAdjust: 24 }; // Scaled by 1.2
  const batteryPos = { x: 36, y: 108, iconYAdjust: 1.2, textYAdjust: 24 }; // Scaled by 1.2
  const gridPos = { x: 240, y: 108, iconYAdjust: 1.2, textYAdjust: 24 }; // Scaled by 1.2
  const evPos = { x: 240, y: 36, iconYAdjust: 1.2, textYAdjust: 24 }; // Scaled by 1.2

  // Icon radius/offset for line connections
  const offset = 16; // For straight lines to icon edge-center
  const diagOffset = 12; // For diagonal lines to icon near-corners

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full min-h-[300px] md:min-h-[500px]"> {/* Adjusted min-height */}
      <CardHeader>
        <CardTitle className="flex items-center text-lg md:text-xl"> {/* Increased font size */}
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Energy Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center p-4 md:p-6"> {/* Added items-center and increased padding */}
        <svg viewBox="0 0 400 300" className="w-full h-auto max-w-md"> {/* Adjusted viewBox height and added max-width */}
					<defs>
						<marker id="arrowhead-green" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-red" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-orange" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						<marker id="arrowhead-blue" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-blue-500, #3B82F6)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						{/* Arrowhead for Solar -> EV */}
						<marker id="arrowhead-solar-ev" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-green-500, #22C55E)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						{/* Arrowhead for Grid -> EV */}
						<marker id="arrowhead-grid-ev" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-red-500, #EF4444)"><polygon points="0 0, 4 1.5, 0 3" /></marker>
						{/* Arrowhead for Battery -> EV */}
						<marker id="arrowhead-battery-ev" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto" fill="var(--color-orange-500, #F97316)"><polygon points="0 0, 4 1.5, 0 3" /></marker>

						{/* Text styles */}
						<style type="text/css">
							{`
								.flow-text {
									font-size: 10px; /* Reduced font size */
									font-weight: medium;
									fill: currentColor; /* Use current text color */
									text-anchor: middle;
									dominant-baseline: middle;
								}
								.line-path {
									fill: none;
								}
							`}
						</style>
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

					{/* Lines with adjusted endpoints */}
					{isSolarToHome && (<line x1={solarPos.x} y1={solarPos.y + offset} x2={homePos.x} y2={homePos.y - offset} className="stroke-green-500" strokeWidth="1.25" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToHome && (<text x={(solarPos.x + homePos.x) / 2} y={(solarPos.y + offset + homePos.y - offset) / 2} className="flow-text">{formatPowerForDisplay(solarToHomeW)}</text>)}

					{isSolarToBattery && (<line x1={solarPos.x - diagOffset} y1={solarPos.y + diagOffset} x2={batteryPos.x + diagOffset} y2={batteryPos.y - diagOffset} className="stroke-green-500" strokeWidth="1.25" markerEnd="url(#arrowhead-green)" />)}
					{isSolarToBattery && (<text x={(solarPos.x - diagOffset + batteryPos.x + diagOffset) / 2 - 5} y={(solarPos.y + diagOffset + batteryPos.y - diagOffset) / 2} className="flow-text">{formatPowerForDisplay(solarToBatteryW)}</text>)}

					{isSolarToGrid && (<line x1={solarPos.x + diagOffset} y1={solarPos.y + diagOffset} x2={gridPos.x - diagOffset} y2={gridPos.y - diagOffset} className="stroke-blue-500" strokeWidth="1.25" markerEnd="url(#arrowhead-blue)" />)}
					{isSolarToGrid && (<text x={(solarPos.x + diagOffset + gridPos.x - diagOffset) / 2 + 5} y={(solarPos.y + diagOffset + gridPos.y - diagOffset) / 2} className="flow-text">{formatPowerForDisplay(solarToGridW)}</text>)}

					{isEVChargingFromSolar && isEVAvailable && (<line x1={solarPos.x} y1={solarPos.y + offset} x2={evPos.x} y2={evPos.y - offset} className="stroke-green-500" strokeWidth="1.25" markerEnd="url(#arrowhead-solar-ev)" />)}
					{isEVChargingFromSolar && isEVAvailable && (<text x={(solarPos.x + evPos.x) / 2} y={(solarPos.y + offset + evPos.y - offset) / 2 - 5} className="flow-text">{formatPowerForDisplay(evChargingFromSolarW)}</text>)}

					{isGridToHome && (<line x1={gridPos.x - offset} y1={gridPos.y} x2={homePos.x + offset} y2={homePos.y} className="stroke-red-500" strokeWidth="1.25" markerEnd="url(#arrowhead-red)" />)}
					{isGridToHome && (<text x={(gridPos.x - offset + homePos.x + offset) / 2} y={(gridPos.y + homePos.y) / 2 - 5} className="flow-text">{formatPowerForDisplay(gridToHomeW)}</text>)}

					{isGridToBattery && (<line x1={gridPos.x - offset} y1={gridPos.y} x2={batteryPos.x + offset} y2={batteryPos.y} className="stroke-red-500" strokeWidth="1.25" markerEnd="url(#arrowhead-red)" />)}
					{isGridToBattery && (<text x={(gridPos.x - offset + batteryPos.x + offset) / 2} y={(gridPos.y + batteryPos.y) / 2 + 5} className="flow-text">{formatPowerForDisplay(gridToBatteryW)}</text>)}

					{isEVChargingFromGrid && isEVAvailable && (<line x1={gridPos.x - diagOffset} y1={gridPos.y + diagOffset} x2={evPos.x + diagOffset} y2={evPos.y - diagOffset} className="stroke-red-500" strokeWidth="1.25" markerEnd="url(#arrowhead-grid-ev)" />)}
					{isEVChargingFromGrid && isEVAvailable && (<text x={(gridPos.x - diagOffset + evPos.x + diagOffset) / 2 + 5} y={(gridPos.y + diagOffset + evPos.y - diagOffset) / 2} className="flow-text">{formatPowerForDisplay(evChargingFromGridW)}</text>)}

					{isBatteryToHome && (<line x1={batteryPos.x + offset} y1={batteryPos.y} x2={homePos.x - offset} y2={homePos.y} className="stroke-green-500" strokeWidth="1.25" markerEnd="url(#arrowhead-green)" />)}
					{isBatteryToHome && (<text x={(batteryPos.x + offset + homePos.x - offset) / 2} y={(batteryPos.y + homePos.y) / 2 + 5} className="flow-text">{formatPowerForDisplay(batteryToHomeW)}</text>)}

					{isBatteryToGrid && (<line x1={batteryPos.x + offset} y1={batteryPos.y} x2={gridPos.x - offset} y2={gridPos.y} className="stroke-blue-500" strokeWidth="1.25" markerEnd="url(#arrowhead-blue)" />)}
					{isBatteryToGrid && (<text x={(batteryPos.x + offset + gridPos.x - offset) / 2} y={(batteryPos.y + gridPos.y) / 2 - 5} className="flow-text">{formatPowerForDisplay(batteryToGridW)}</text>)}

					{isEVChargingFromBattery && isEVAvailable && (<line x1={batteryPos.x + diagOffset} y1={batteryPos.y + diagOffset} x2={evPos.x - diagOffset} y2={evPos.y - diagOffset} className="stroke-orange-500" strokeWidth="1.25" markerEnd="url(#arrowhead-battery-ev)" />)}
					{isEVChargingFromBattery && isEVAvailable && (<text x={(batteryPos.x + diagOffset + evPos.x - diagOffset) / 2 - 5} y={(batteryPos.y + diagOffset + evPos.y - diagOffset) / 2} className="flow-text">{formatPowerForDisplay(evChargingFromBatteryW)}</text>)}

					{/* Text for Solar Node */}
					<text x={solarPos.x} y={solarPos.y + solarPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(solarGenerationWatts)}</text>

					{/* Text for Grid Node */}
					<text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{gridNodePowerText}</text>
					<text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}</text>

					{/* Text for Home Node */}
					<text x={homePos.x} y={homePos.y + homePos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{formatPowerForDisplay(homeConsumptionWatts)}</text>

					{/* Text for Battery Node */}
					<text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{batteryNodePowerText}</text>
					<text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">{batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}</text>

					{/* Text for EV Node */}
					{isEVAvailable && (<text x={evPos.x} y={evPos.y + evPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">{evNodePowerText}</text>)}

					{/* Icons and Text */}
					<g transform={`translate(${solarPos.x - 16}, ${solarPos.y + solarPos.iconYAdjust - 16})`}><Sun className="h-8 w-8 text-yellow-500" /></g>

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
