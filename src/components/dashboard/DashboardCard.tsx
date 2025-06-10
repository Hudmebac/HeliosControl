import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils"; // Assuming cn is for conditional class names
import { Sun, Battery, Car, Home, Power } from "lucide-react"; // Import necessary icons

interface DashboardCardProps {
  title: string;
  value: number | string;
  unit?: string;
  solarValue?: number; // Added solar generation value for comparison
  icon?: ReactNode;
  description?: string;
  children?: ReactNode;
  className?: string;
  isLoading?: boolean;
  valueColorClassName?: string;
}

const getHomeConsumptionIcon = (consumption: number, solarGeneration: number): ReactNode => {
  let color = "text-green-500"; // Default: Less than solar generation
  if (consumption > solarGeneration) color = "text-orange-500"; // Greater than solar generation
  if (consumption > 3.5) color = "text-red-500"; // Greater than 3.5kW

  return <Home className={`h-4 w-4 ${color}`} />;
};

const getBatteryIcon = (percentage: number): ReactNode => {
  let color = "text-red-500";
  if (percentage >= 25) color = "text-orange-800";
  if (percentage >= 50) color = "text-orange-500";
  if (percentage >= 75) color = "text-green-400";
  if (percentage === 100) color = "text-green-800";

  return <Battery className={`h-4 w-4 ${color}`} />;
};

export function DashboardCard({ title, value, unit, solarValue, icon, description, children, className, isLoading, valueColorClassName }: DashboardCardProps) {
  const displayIcon =
    title === "Battery Status" && typeof value === "number"
      ? getBatteryIcon(value)
      : title === "Home Consumption" && typeof value === "number" && typeof solarValue === "number"
      ? getHomeConsumptionIcon(value, solarValue)
      : icon;

  return (
    <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-primary">{displayIcon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-10 w-3/4 bg-muted animate-pulse rounded-md"></div>
        ) : (
          <div className={cn("text-2xl font-bold transition-colors duration-500 ease-in-out", valueColorClassName)}>
            {typeof value === "number" ? value : value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
        {children && !isLoading && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}