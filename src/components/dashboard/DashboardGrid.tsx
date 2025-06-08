
"use client"

import { DashboardCard } from "./DashboardCard";
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, Bolt, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, PowerOff, Power, PlugZap, Loader2 } from "lucide-react";
import type { BatteryStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";

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
      if (originalValue < 1) {
        return { value: Math.round(originalValue * 1000), unit: "W" };
      }
      // For kW values >= 1, ensure consistent decimal places (e.g., 2 decimal places if not whole)
      // The toFixed is already applied in givenergy.ts when creating the number, so originalValue is like 1.23 or 0.54
      return { value: Number.isInteger(originalValue) ? originalValue : originalValue.toFixed(2), unit: "kW" };
    }
    // For non-kW units or non-numeric kW values (like "N/A"), return as is
    return { value: originalValue, unit: originalUnit };
  };

  const homeConsumptionFormatted = formatPowerValue(data.homeConsumption.value, data.homeConsumption.unit);
  const solarGenerationFormatted = formatPowerValue(data.solarGeneration.value, data.solarGeneration.unit);
  const gridFormatted = formatPowerValue(data.grid.value, data.grid.unit);
  const evChargerFormatted = formatPowerValue(data.evCharger.value, data.evCharger.unit);

  const actualCardData = [
    { title: "Home Consumption", value: homeConsumptionFormatted.value, unit: homeConsumptionFormatted.unit, icon: <Home className="h-6 w-6" />, description: `Updated: ${new Date(data.timestamp).toLocaleTimeString()}` },
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
          isLoading={false} 
        />
      ))}
    </div>
  );
}
