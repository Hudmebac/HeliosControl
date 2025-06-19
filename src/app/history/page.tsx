
"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { getHistoricalEnergyData } from "@/lib/givenergy.ts"; // Explicitly import from .ts
import type { HistoricalEnergyDataPoint } from "@/lib/types";
import { format, subDays, parseISO } from "date-fns";
import { ArrowLeft, CalendarIcon, Loader2, AlertTriangle, BarChart3, LineChartIcon, BatteryCharging, SunMedium, HomeIcon } from "lucide-react";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


// Helper to format date for display
const formatDateForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "PPP") : "Pick a date";
};

// Helper to format date for API (YYYY-MM-DD)
const formatDateForApi = (date: Date): string => {
  return format(date, "yyyy-MM-dd");
};


export default function HistoryPage() {
  const { apiKey, inverterSerial, isLoadingApiKey } = useApiKey();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [historicalData, setHistoricalData] = useState<HistoricalEnergyDataPoint[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chartColor = theme === 'dark' || theme === 'hc-dark' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))';
  const solarColor = "hsl(var(--chart-1))"; 
  const gridImportColor = "hsl(var(--chart-2))";
  const batteryDischargeColor = "hsl(var(--chart-3))";
  const batteryChargeColor = "hsl(var(--chart-4))";
  const consumptionColor = "hsl(var(--chart-5))";
  const gridExportColor = "hsl(var(--chart-1))"; 

  const fetchData = useCallback(async () => {
    if (!apiKey || !inverterSerial || !startDate || !endDate) {
      setError("API key, inverter serial, or date range not set.");
      setHistoricalData([]);
      return;
    }
    if (endDate < startDate) {
        setError("End date cannot be earlier than start date.");
        toast({variant: "destructive", title: "Invalid Date Range", description: "End date cannot be earlier than start date."});
        setHistoricalData([]);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getHistoricalEnergyData(apiKey, inverterSerial, startDate, endDate);
      setHistoricalData(data);
      if (data.length === 0) {
        toast({ title: "No Data", description: "No historical data found for the selected range."});
      }
    } catch (e: any) {
      console.error("Error fetching historical data:", e);
      setError(e.message || "Failed to fetch historical data.");
      setHistoricalData([]);
      toast({ variant: "destructive", title: "Fetch Error", description: e.message || "Could not load historical data."});
    } finally {
      setLoading(false);
    }
  }, [apiKey, inverterSerial, startDate, endDate, toast]);

  useEffect(() => {
    if (apiKey && inverterSerial && !isLoadingApiKey) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, inverterSerial, isLoadingApiKey, fetchData]); // Added fetchData to dependency array

  const formattedChartData = historicalData.map(item => ({
    ...item,
    // Short date format for XAxis labels
    shortDate: format(parseISO(item.date), "MMM d"),
  }));
  
  const DailyEnergyOverviewChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={formattedChartData}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
        <XAxis dataKey="shortDate" />
        <YAxis yAxisId="left" label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
        <Tooltip 
          formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name.replace(/([A-Z])/g, ' $1').trim()]} 
          labelFormatter={(label: string) => `Date: ${label}`}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="solarGeneration" name="Solar Generation" fill={solarColor} stackId="a" />
        <Bar yAxisId="left" dataKey="gridImport" name="Grid Import" fill={gridImportColor} stackId="a" />
        <Bar yAxisId="left" dataKey="batteryDischarge" name="Battery Discharge to Home/Grid" fill={batteryDischargeColor} stackId="a" />
        <Line yAxisId="left" type="monotone" dataKey="consumption" name="Total Consumption" stroke={consumptionColor} strokeWidth={2} dot={{r:3}} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const SolarDistributionChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={formattedChartData}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
        <XAxis dataKey="shortDate" />
        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
        <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name.replace(/([A-Z])/g, ' $1').trim()]} />
        <Legend />
        <Bar dataKey="solarToHome" name="Solar to Home" stackId="solar" fill={solarColor} />
        <Bar dataKey="solarToBattery" name="Solar to Battery" stackId="solar" fill="hsl(var(--chart-2))" />
        <Bar dataKey="solarToGrid" name="Solar to Grid" stackId="solar" fill="hsl(var(--chart-3))" />
      </BarChart>
    </ResponsiveContainer>
  );

  const BatteryUsageChart = () => (
     <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={formattedChartData}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5}/>
        <XAxis dataKey="shortDate" />
        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }}/>
        <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name]}/>
        <Legend />
        <Bar dataKey="batteryCharge" name="Battery Charged" fill={batteryChargeColor} />
        <Bar dataKey="batteryDischarge" name="Battery Discharged" fill={batteryDischargeColor} />
      </ComposedChart>
    </ResponsiveContainer>
  );


  return (
    <div className="w-full space-y-8 py-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl flex items-center">
          <BarChart3 className="mr-3 h-8 w-8 text-primary" />
          Energy History
        </h1>
        <Button variant="outline" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range Selection</CardTitle>
          <CardDescription>Select the start and end dates for the energy history report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="start-date">Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="start-date" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateForDisplay(startDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label htmlFor="end-date">End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="end-date" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateForDisplay(endDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={fetchData} disabled={loading || !apiKey || !inverterSerial} className="w-full sm:w-auto">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fetch History"}
          </Button>
        </CardContent>
      </Card>

      {isLoadingApiKey && (
         <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p>Loading API Key information...</p>
        </div>
      )}

      {!apiKey && !isLoadingApiKey && (
        <Alert variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>API Key Required</AlertTitle>
          <AlertDescription>
            Please set your GivEnergy API key in settings to view historical data.
          </AlertDescription>
        </Alert>
      )}
      
      {!inverterSerial && apiKey && !isLoadingApiKey && (
         <Alert variant="default">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Inverter Serial Required</AlertTitle>
          <AlertDescription>
            Could not determine your inverter serial number. Ensure your API key is correct and has access to device information.
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p>Loading historical data...</p>
        </div>
      )}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && historicalData.length > 0 && apiKey && inverterSerial && (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><HomeIcon className="mr-2 h-5 w-5 text-primary"/>Daily Energy Overview</CardTitle>
                <CardDescription>Summary of daily energy consumption and sources.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <DailyEnergyOverviewChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><SunMedium className="mr-2 h-5 w-5 text-primary"/>Solar Generation Distribution</CardTitle>
                <CardDescription>How your generated solar energy was used each day.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <SolarDistributionChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><BatteryCharging className="mr-2 h-5 w-5 text-primary"/>Battery Usage Patterns</CardTitle>
                <CardDescription>Daily energy charged into and discharged from your battery.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <BatteryUsageChart />
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {!loading && !error && historicalData.length === 0 && apiKey && inverterSerial && (
         <div className="text-center py-10 text-muted-foreground">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p>No data to display for the selected period, or initial load pending.</p>
            <p>Try adjusting the date range or click "Fetch History".</p>
        </div>
      )}
    </div>
  );
}

