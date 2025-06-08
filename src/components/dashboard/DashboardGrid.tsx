
"use client"

import { DashboardCard } from "./DashboardCard";
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, Bolt, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, PowerOff, Power, PlugZap, Loader2 } from "lucide-react";
import type { BatteryStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // Ensure cn is imported if not already

interface DashboardGridProps {
  apiKey: string;
}

function getBatteryIcon(battery: BatteryStatus) {
  if (battery.charging) return <BatteryCharging className="h-6 w-6" />;
  if (battery.percentage > 80) return <BatteryFull className="h-6 w-6" />;
  if (battery.percentage > 40) return <BatteryMedium className="h-6 w-6" />;
  if (battery.percentage > 10) return <BatteryLow className="h-6 w-6" />;
  return <BatteryWarning className="h-6 w-6" />;
}

export function DashboardGrid({ apiKey }: DashboardGridProps) {
  const { data, isLoading, error, refetch } = useGivEnergyData(apiKey);

  if (error && !data) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Fetching Data</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }
  
  // Show skeletons only on initial load when data is null
  if (isLoading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array(5).fill(0).map((_, index) => (
          <DashboardCard
            key={`skeleton-${index}`}
            title=""
            value=""
            icon={<Zap className="h-6 w-6 text-muted" />}
            isLoading={true}
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Waiting for data...</p>
      </div>
    );
  }

  const formatPowerValue = (originalValue: number | string, originalUnit: string): { value: string | number; unit: string } => {
    if (originalUnit === "kW" && typeof originalValue === 'number') {
      if (originalValue === 0) {
        return { value: 0, unit: "W" };
      }
      if (originalValue < 1 && originalValue > -1) { // Also handles small negative numbers if they appear before Math.abs
        return { value: Math.round(originalValue * 1000), unit: "W" };
      }
      return { value: Number.isInteger(originalValue) ? originalValue : originalValue.toFixed(2), unit: "kW" };
    }
    return { value: originalValue, unit: originalUnit };
  };

  const homeConsumptionFormatted = formatPowerValue(data.homeConsumption.value, data.homeConsumption.unit);
  const solarGenerationFormatted = formatPowerValue(data.solarGeneration.value, data.solarGeneration.unit);
  const gridFormatted = formatPowerValue(data.grid.value, data.grid.unit);
  const evChargerFormatted = formatPowerValue(data.evCharger.value, data.evCharger.unit);

  // Determine Home Consumption color
  let hcColor = "";
  const consumptionKW = data.numericHomeConsumptionKW;
  const solarKW = data.numericSolarGenerationKW;
  const batteryDischargeKW = data.numericBatteryDischargeKW;
  const gridImportKW = data.numericGridImportKW;
  const epsilon = 0.01; // Threshold for small values

  if (consumptionKW <= epsilon) { // Negligible consumption
    if (solarKW > epsilon) {
      hcColor = "text-green-600"; // Solar is active (exporting/charging battery)
    }
    // Default: no specific color if consumption is zero and no solar
  } else { // Active consumption
    if (gridImportKW > epsilon) {
      hcColor = "text-red-600"; // Any grid import
    } else if (solarKW >= consumptionKW - epsilon) { // Primarily solar
      hcColor = "text-green-600";
    } else if (solarKW + batteryDischargeKW >= consumptionKW - epsilon) { // Solar + Battery
      if (solarKW > epsilon) { // Both contributing
        hcColor = "text-orange-500";
      } else { // Primarily battery
        hcColor = "text-orange-700"; // Darker orange
      }
    }
    // If none of the above, implies an unusual state or covered by grid import, default color.
  }


  const actualCardData = [
    { title: "Home Consumption", value: homeConsumptionFormatted.value, unit: homeConsumptionFormatted.unit, icon: <Home className="h-6 w-6" />, description: `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`, valueColorClassName: hcColor },
    { title: "Solar Generation", value: solarGenerationFormatted.value, unit: solarGenerationFormatted.unit, icon: <Sun className="h-6 w-6" /> },
    { title: "Battery Status", value: data.battery.value, unit: data.battery.unit, icon: getBatteryIcon(data.battery), description: data.battery.charging ? "Charging" : data.battery.charging === false ? "Discharging" : "Idle" },
    { title: "Grid Status", value: gridFormatted.value, unit: gridFormatted.unit, icon: data.grid.flow === 'idle' ? <PowerOff className="h-6 w-6" /> : <PlugZap className="h-6 w-6" />, description: data.grid.flow.charAt(0).toUpperCase() + data.grid.flow.slice(1) },
    { title: "EV Charger", value: evChargerFormatted.value, unit: evChargerFormatted.unit, icon: data.evCharger.status === 'charging' ? <Bolt className="h-6 w-6 text-green-500" /> : <Power className="h-6 w-6" />, description: data.evCharger.status.charAt(0).toUpperCase() + data.evCharger.status.slice(1) },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {actualCardData.map((card, index) => (
        <DashboardCard
          key={index}
          title={card.title}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          description={card.description}
          isLoading={isLoading && !data} // Pass isLoading only if there's no data yet
          valueColorClassName={card.valueColorClassName}
        />
      ))}
    </div>
  );
}
