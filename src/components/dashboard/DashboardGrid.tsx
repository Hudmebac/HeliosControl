
"use client"

import { DashboardCard } from "./DashboardCard";
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, Bolt, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, PowerOff, Power, PlugZap } from "lucide-react";
import type { RealTimeData, BatteryStatus } from "@/lib/types";
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

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Fetching Data</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }
  
  const cardData = data ? [
    { title: "Home Consumption", value: data.homeConsumption.value, unit: data.homeConsumption.unit, icon: <Home className="h-6 w-6" />, description: `Updated: ${new Date(data.timestamp).toLocaleTimeString()}` },
    { title: "Solar Generation", value: data.solarGeneration.value, unit: data.solarGeneration.unit, icon: <Sun className="h-6 w-6" /> },
    { title: "Battery Status", value: data.battery.value, unit: data.battery.unit, icon: getBatteryIcon(data.battery), description: data.battery.charging ? "Charging" : data.battery.charging === false ? "Discharging" : "Idle" },
    { title: "Grid Status", value: data.grid.value, unit: data.grid.unit, icon: data.grid.flow === 'idle' ? <PowerOff className="h-6 w-6" /> : <PlugZap className="h-6 w-6" />, description: data.grid.flow.charAt(0).toUpperCase() + data.grid.flow.slice(1) },
    { title: "EV Charger", value: data.evCharger.value, unit: data.evCharger.unit, icon: data.evCharger.status === 'charging' ? <Bolt className="h-6 w-6 text-green-500" /> : <Power className="h-6 w-6" />, description: data.evCharger.status.charAt(0).toUpperCase() + data.evCharger.status.slice(1) },
  ] : Array(5).fill({}).map((_, i) => ({ title: `Metric ${i+1}`, value: "N/A", unit: "", icon: <Zap className="h-6 w-6" />, isLoading: true }));


  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cardData.map((card, index) => (
        <DashboardCard
          key={index}
          title={card.title}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          description={card.description}
          isLoading={isLoading || card.isLoading}
        />
      ))}
    </div>
  );
}
