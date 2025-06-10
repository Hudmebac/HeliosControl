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
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface EnergyFlowVisualProps {
  data: RealTimeData | null;
}

const THRESHOLD_KW = 0.05; // 50W threshold to show a flow

export function EnergyFlowVisual({ data }: EnergyFlowVisualProps) {
  if (!data) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p>Energy flow data unavailable.</p>
        </CardContent>
      </Card>
    );
  }

  const {
    numericSolarGenerationKW,
    numericHomeConsumptionKW,
    rawGridPowerWatts,
    battery,
    grid,
  } = data;

  const solarKW = numericSolarGenerationKW;
  const homeKW = numericHomeConsumptionKW;

  // Use effective battery power from data.battery.rawPowerWatts
  const effectiveBatteryPowerWatts = battery.rawPowerWatts || 0;
  const batteryIsCharging = effectiveBatteryPowerWatts < -THRESHOLD_KW * 1000;
  const batteryIsDischarging = effectiveBatteryPowerWatts > THRESHOLD_KW * 1000;
  const batteryAbsPowerKW = Math.abs(effectiveBatteryPowerWatts) / 1000;

  const gridPowerAbsKW = Math.abs(rawGridPowerWatts) / 1000;
  const gridIsImporting = grid.flow === "importing" && gridPowerAbsKW > THRESHOLD_KW;
  const gridIsExporting = grid.flow === "exporting" && gridPowerAbsKW > THRESHOLD_KW;

  // Determine active flows
  const isSolarToHome = solarKW > THRESHOLD_KW && homeKW > THRESHOLD_KW;
  const isGridToHome = gridIsImporting && homeKW > THRESHOLD_KW;
  const isBatteryToHome = batteryIsDischarging && homeKW > THRESHOLD_KW;

  const isSolarToBattery = batteryIsCharging && solarKW > THRESHOLD_KW && (!gridIsImporting || solarKW > gridPowerAbsKW);
  const isGridToBattery = batteryIsCharging && gridIsImporting;
  
  const isSolarToGrid = gridIsExporting && solarKW > THRESHOLD_KW;
  const isBatteryToGrid = gridIsExporting && batteryIsDischarging;

  const formatKW = (value: number | string) => {
    if (typeof value === 'string') return value; // For "N/A" or other strings
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


  // Adjusted coordinates for a more diamond-like layout
  // SVG Viewbox: 0 0 400 320
  const solarPos = { x: 200, y: 50, iconYAdjust: -15, textYAdjust: 25 };
  const gridPos =  { x: 70,  y: 160, iconYAdjust: -15, textYAdjust: 25 };
  const homePos =  { x: 200, y: 270, iconYAdjust: -15, textYAdjust: 25 };
  const batteryPos={ x: 330, y: 160, iconYAdjust: -15, textYAdjust: 25 };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Energy Flow
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <svg viewBox="0 0 400 320" className="w-full h-auto">
          <defs>
            <marker
              id="arrowhead-green"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              fill="var(--color-green-500, #10B981)"
            >
              <polygon points="0 0, 8 3, 0 6" />
            </marker>
            <marker
              id="arrowhead-red"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              fill="var(--color-red-500, #EF4444)"
            >
              <polygon points="0 0, 8 3, 0 6" />
            </marker>
            <marker
              id="arrowhead-orange"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              fill="var(--color-orange-500, #F97316)"
            >
              <polygon points="0 0, 8 3, 0 6" />
            </marker>
            <marker
              id="arrowhead-blue"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              fill="var(--color-blue-500, #3B82F6)"
            >
              <polygon points="0 0, 8 3, 0 6" />
            </marker>
          </defs>

          {/* Lines - Order matters for potential overlap, draw less important ones first or adjust paths */}
          {/* Solar to Home */}
          {isSolarToHome && (
            <line
              x1={solarPos.x} y1={solarPos.y + 10}
              x2={homePos.x} y2={homePos.y - 25}
              className="stroke-green-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-green)"
            />
          )}
          {/* Solar to Battery */}
          {isSolarToBattery && (
            <line
              x1={solarPos.x + 10} y1={solarPos.y + 5}
              x2={batteryPos.x - 20} y2={batteryPos.y - 10}
              className="stroke-green-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-green)"
            />
          )}
          {/* Solar to Grid (Export) */}
          {isSolarToGrid && (
             <line
              x1={solarPos.x - 10} y1={solarPos.y + 5}
              x2={gridPos.x + 20} y2={gridPos.y - 10}
              className="stroke-blue-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-blue)"
            />
          )}

          {/* Grid to Home */}
          {isGridToHome && (
            <line
              x1={gridPos.x + 15} y1={gridPos.y + 10}
              x2={homePos.x - 15} y2={homePos.y - 25}
              className="stroke-red-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-red)"
            />
          )}
          {/* Grid to Battery */}
          {isGridToBattery && (
            <line
              x1={gridPos.x + 25} y1={gridPos.y}
              x2={batteryPos.x - 25} y2={batteryPos.y}
              className="stroke-red-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-red)"
            />
          )}

          {/* Battery to Home */}
          {isBatteryToHome && (
            <line
              x1={batteryPos.x - 10} y1={batteryPos.y + 10}
              x2={homePos.x + 10} y2={homePos.y - 25}
              className="stroke-orange-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-orange)"
            />
          )}
          {/* Battery to Grid (Export) */}
          {isBatteryToGrid && (
             <line
              x1={batteryPos.x - 20} y1={batteryPos.y - 5}
              x2={gridPos.x + 20} y2={gridPos.y + 5}
              className="stroke-blue-500" strokeWidth="2.5"
              markerEnd="url(#arrowhead-blue)"
            />
          )}

          {/* Nodes (Icons & Text) - Rendered on top of lines */}
          {/* Solar Node */}
          <g transform={`translate(${solarPos.x - 16}, ${solarPos.y + solarPos.iconYAdjust - 16})`}>
            <Sun className="h-8 w-8 text-yellow-500" />
          </g>
          <text x={solarPos.x} y={solarPos.y + solarPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">
            {formatKW(solarKW)} kW
          </text>

          {/* Grid Node */}
           <g transform={`translate(${gridPos.x - 16}, ${gridPos.y + gridPos.iconYAdjust - 16})`}>
            <Power className={cn("h-8 w-8", gridIsImporting ? "text-red-500" : gridIsExporting ? "text-blue-500" : "text-muted-foreground" )} />
          </g>
          <text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">
            {gridNodePowerText}
          </text>
          <text x={gridPos.x} y={gridPos.y + gridPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">
            {gridIsImporting ? "Import" : gridIsExporting ? "Export" : "Idle"}
          </text>

          {/* Home Node */}
          <g transform={`translate(${homePos.x - 16}, ${homePos.y + homePos.iconYAdjust - 16})`}>
            <Home className="h-8 w-8 text-primary" />
          </g>
          <text x={homePos.x} y={homePos.y + homePos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">
            {formatKW(homeKW)} kW
          </text>

          {/* Battery Node */}
          <g transform={`translate(${batteryPos.x - 16}, ${batteryPos.y + batteryPos.iconYAdjust - 16})`}>
            {getBatteryIcon()}
          </g>
          <text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust} textAnchor="middle" className="fill-current text-xs font-medium">
            {batteryNodePowerText}
          </text>
           <text x={batteryPos.x} y={batteryPos.y + batteryPos.textYAdjust + 12} textAnchor="middle" className="fill-current text-xs text-muted-foreground">
            {batteryIsCharging ? "Charging" : batteryIsDischarging ? "Discharging" : "Idle"}
          </text>

        </svg>

        <div className="mt-auto pt-4">
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

// Helper for marker fill colors if needed (alternative to direct className for fill)
// This is not strictly needed if Tailwind JIT works with CSS variables in SVG.
// const markerColors = {
//   green: "#10B981", // green-500
//   red: "#EF4444",   // red-500
//   orange: "#F97316",// orange-500
//   blue: "#3B82F6",  // blue-500
// };
// style={{ fill: markerColors.green }}

