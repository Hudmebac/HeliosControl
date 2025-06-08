
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

  // If there's an error AND no data (even stale) to display, show the error message.
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

  // Show skeletons only if we are loading AND there's no existing data.
  // This handles the initial load gracefully.
  if (isLoading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array(5).fill(0).map((_, index) => (
          <DashboardCard
            key={`skeleton-${index}`}
            title="" // Title can be empty; pulse will show where it would be
            value="" // Value is empty; pulse will show
            icon={<Zap className="h-6 w-6 text-muted" />} // Muted icon for skeleton
            isLoading={true} // This prop makes DashboardCard render its internal pulse
          />
        ))}
      </div>
    );
  }

  // If we don't have data yet, but we are not loading and there's no error,
  // it might be a very brief state or initial setup. Show a generic loader.
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Waiting for data...</p>
      </div>
    );
  }

  // If we have data (even if `isLoading` is true for a refresh), render the cards with data.
  // `DashboardCard.isLoading` will be false here, so no individual card pulsing.
  const actualCardData = [
    { title: "Home Consumption", value: data.homeConsumption.value, unit: data.homeConsumption.unit, icon: <Home className="h-6 w-6" />, description: `Updated: ${new Date(data.timestamp).toLocaleTimeString()}` },
    { title: "Solar Generation", value: data.solarGeneration.value, unit: data.solarGeneration.unit, icon: <Sun className="h-6 w-6" /> },
    { title: "Battery Status", value: data.battery.value, unit: data.battery.unit, icon: getBatteryIcon(data.battery), description: data.battery.charging ? "Charging" : data.battery.charging === false ? "Discharging" : "Idle" },
    { title: "Grid Status", value: data.grid.value, unit: data.grid.unit, icon: data.grid.flow === 'idle' ? <PowerOff className="h-6 w-6" /> : <PlugZap className="h-6 w-6" />, description: data.grid.flow.charAt(0).toUpperCase() + data.grid.flow.slice(1) },
    { title: "EV Charger", value: data.evCharger.value, unit: data.evCharger.unit, icon: data.evCharger.status === 'charging' ? <Bolt className="h-6 w-6 text-green-500" /> : <Power className="h-6 w-6" />, description: data.evCharger.status.charAt(0).toUpperCase() + data.evCharger.status.slice(1) },
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
          isLoading={false} // Critically, this is false when showing actual data
        />
      ))}
    </div>
  );
}
