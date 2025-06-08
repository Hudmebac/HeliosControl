
"use client"

import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  description?: string;
  children?: ReactNode; // For additional content like small charts or status indicators
  className?: string;
  isLoading?: boolean;
}

export function DashboardCard({ title, value, unit, icon, description, children, className, isLoading }: DashboardCardProps) {
  return (
    <Card className={cn("shadow-lg hover:shadow-xl transition-shadow duration-300", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
           <div className="h-10 w-3/4 bg-muted animate-pulse rounded-md"></div>
        ) : (
          <div className="text-2xl font-bold">
            {value}
            {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
        {children && !isLoading && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
