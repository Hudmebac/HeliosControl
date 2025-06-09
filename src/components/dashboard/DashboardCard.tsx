
"use client"

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils"; // Assuming cn is for conditional class names
import { Sun, Battery, Grid, Car, Home, Power } from "lucide-react"; // Import necessary icons

interface DashboardCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  description?: string;
  children?: ReactNode; // For additional content like small charts or status indicators
  className?: string;
  isLoading?: boolean;
  valueColorClassName?: string; // New prop for specific value color
}

const cardIcons: { [key: string]: ReactNode } = {
  "Home Consumption": <Home className="h-4 w-4 text-muted-foreground" />,
  "Solar Generation": <Sun className="h-4 w-4 text-muted-foreground" />,
  "Battery Status": <Battery className="h-4 w-4 text-muted-foreground" />,
  "Grid Status": <Power className="h-4 w-4 text-muted-foreground" />, // Using Power for Pylon as it's a common representation
  "EV Charger": <Car className="h-4 w-4 text-muted-foreground" />,
};

export function DashboardCard({ title, value, unit, icon, description, children, className, isLoading, valueColorClassName }: DashboardCardProps) {
  return (
    <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-primary">{cardIcons[title] || icon}</div> {/* Use the mapping, fallback to passed icon */}
      </CardHeader>
      <CardContent>
        {isLoading ? (
           <div className="h-10 w-3/4 bg-muted animate-pulse rounded-md"></div>
        ) : (
          <div className={cn("text-2xl font-bold transition-colors duration-500 ease-in-out", valueColorClassName)}>
            {typeof value === 'number' ? (
              // Format numbers with consistent decimal places if needed,
              // or handle based on unit/type if more complex formatting is required.
              // For simplicity, displaying numbers as is for now.
              value
            ) : (
              value
            )}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
        {children && !isLoading && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
