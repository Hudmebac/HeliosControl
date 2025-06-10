"use client";

import { DashboardCard } from "./DashboardCard";
import { useGivEnergyData } from "@/hooks/use-giv-energy-data";
import { Home, Sun, BatteryCharging, Zap, AlertTriangle, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning, Power, PlugZap, Loader2 } from "lucide-react";
import type { BatteryStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface DashboardGridProps {
  apiKey: string;
}

// **Helper Function: Battery Status**
const getBatteryStatus = (battery: BatteryStatus) => {
  let description = "Idle";
  let color = "text-muted-foreground";
  let icon = <BatteryWarning className="h-6 w-6 text-red-700" />;

  if (battery.charging) {
    description = "Charging";
    color = "text-blue-500";
    icon = <BatteryCharging className="h-6 w-6 text-blue-500" />;
  } else if (battery.percentage > 80) {
    description = "Full";
    color = "text-green-500";
    icon = <BatteryFull className="h-6 w-6 text-green-500" />;
  } else if (battery.percentage > 40) {
    description = "Medium Charge";
    color = "text-orange-500";
    icon = <BatteryMedium className="h-6 w-6 text-orange-500" />;
  } else if (battery.percentage > 10) {
    description = "Low Charge";
    color = "text-red-500";
    icon = <BatteryLow className="h-6 w-6 text-red-500" />;
  } else {
    description = "Critical!";
    color = "text-red-700";
  }

  return { description, color, icon };
};

// **Helper Function: Home Consumption**
const getHomeConsumptionStatus = (consumption: number, solarGeneration: number, gridImport: number) => {
  if (consumption <= 0.01) {
    return { color: solarGeneration > 0.01 ? "text-green-600" : "", icon: <Home className="h-6 w-6 text-green-600" /> };
  }
  if (gridImport > 0.01) {
    return { color: "text-red-600", icon: <Home className="h-6 w-6 text-red-600" /> };
  }
  if (solarGeneration >= consumption - 0.01) {
    return { color: "text-green-600", icon: <Home className="h-6 w-6 text-green-600" /> };
  }
  return { color: "text-orange-500", icon: <Home className="h-6 w-6 text-orange-500" /> };
};

// **Helper Function: Solar Generation**
const getSolarGenerationColor = (solarKW: number) => {
  if (solarKW < 1) return "text-[#C0C0C0]"; // Silver
  if (solarKW <= 3.5) return "text-[#00A86B]"; // Green
  return "text-[#FFA500]"; // Orange
};

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
          <DashboardCard key={`skeleton-${index}`} title="" value="" icon={<Zap className="h-6 w-6 text-muted" />} isLoading={true} />
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

  const homeStatus = getHomeConsumptionStatus(data.numericHomeConsumptionKW, data.numericSolarGenerationKW, data.numericGridImportKW);
  const batteryStatus = getBatteryStatus(data.battery);
  const solarColorClassName = getSolarGenerationColor(data.numericSolarGenerationKW);

  const actualCardData = [
    {
      title: "Home Consumption",
      value: data.homeConsumption.value,
      unit: data.homeConsumption.unit,
      icon: homeStatus.icon,
      description: `Updated: ${new Date(data.timestamp).toLocaleTimeString()}`,
      valueColorClassName: homeStatus.color,
      iconColorClassName: homeStatus.color,
    },
    {
      title: "Solar Generation",
      value: data.solarGeneration.value,
      unit: data.solarGeneration.unit,
      icon: <Sun className="h-6 w-6" />,
      valueColorClassName: solarColorClassName,
      iconColorClassName: solarColorClassName,
    },
    {
      title: "Battery Status",
      value: data.battery.value,
      unit: data.battery.unit,
      icon: batteryStatus.icon,
      description: batteryStatus.description,
      valueColorClassName: batteryStatus.color,
      iconColorClassName: batteryStatus.color,
    },
    {
      title: "Grid Status",
      value: data.grid.value,
      unit: data.grid.unit,
      icon: <Power className="h-6 w-6" />,
      description: data.grid.flow.charAt(0).toUpperCase() + data.grid.flow.slice(1),
    },
    {
      title: "EV Charger",
      value: data.evCharger.value,
      unit: data.evCharger.unit,
      icon: <PlugZap className="h-6 w-6" />,
      description: data.evCharger.status,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {actualCardData.map((card, index) => (
        <DashboardCard
          key={card.title === "Home Consumption" ? card.description : index}
          title={card.title}
          value={card.value}
          unit={card.unit}
          icon={card.icon}
          description={card.description}
          isLoading={isLoading && !data}
          valueColorClassName={card.valueColorClassName}
          iconColorClassName={card.iconColorClassName}
        />
      ))}
    </div>
  );
}