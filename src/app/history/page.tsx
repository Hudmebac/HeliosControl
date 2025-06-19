
"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { getHistoricalEnergyData } from "@/lib/givenergy.ts";
import type { HistoricalEnergyDataPoint } from "@/lib/types";
import { format, subDays, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ArrowLeft, CalendarIcon, Loader2, AlertTriangle, BarChart3, LineChartIcon, BatteryCharging, SunMedium, HomeIcon } from "lucide-react";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Helper to format date for display
const formatDateForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "PPP") : "Pick a date";
};

type GroupingOptionValue = "1" | "2" | "3" | "4"; // 1:Daily, 2:Weekly, 3:Monthly, 4:Yearly

interface GroupingOption {
  value: GroupingOptionValue;
  label: string;
  datePickerLabel: string;
}

const groupingOptions: GroupingOption[] = [
  { value: "1", label: "Daily", datePickerLabel: "Select Day" },
  { value: "2", label: "Weekly", datePickerLabel: "Select Day in Target Week" },
  { value: "3", label: "Monthly", datePickerLabel: "Select Day in Target Month" },
  { value: "4", label: "Yearly", datePickerLabel: "Select Day in Target Year" },
];

export default function HistoryPage() {
  const { apiKey, inverterSerial, isLoadingApiKey } = useApiKey();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [periodDate, setPeriodDate] = useState<Date | undefined>(new Date());
  const [historicalData, setHistoricalData] = useState<HistoricalEnergyDataPoint[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGrouping, setSelectedGrouping] = useState<GroupingOptionValue>("1");

  const chartColor = theme === 'dark' || theme === 'hc-dark' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))';
  const solarColor = "hsl(var(--chart-1))"; 
  const gridImportColor = "hsl(var(--chart-2))";
  const batteryDischargeColor = "hsl(var(--chart-3))";
  const batteryChargeColor = "hsl(var(--chart-4))";
  const consumptionColor = "hsl(var(--chart-5))";
  const gridExportColor = "hsl(var(--chart-1))"; 

  const fetchData = useCallback(async () => {
    if (!apiKey || !inverterSerial || !periodDate) {
      setError("API key, inverter serial, or date not set.");
      setHistoricalData([]);
      return;
    }

    setLoading(true);
    setError(null);

    let apiStartDate: Date;
    let apiEndDate: Date;

    switch (selectedGrouping) {
      case "1": // Daily
        apiStartDate = periodDate;
        apiEndDate = periodDate;
        break;
      case "2": // Weekly
        apiStartDate = startOfWeek(periodDate, { weekStartsOn: 1 }); // Monday as start of week
        apiEndDate = endOfWeek(periodDate, { weekStartsOn: 1 });
        break;
      case "3": // Monthly
        apiStartDate = startOfMonth(periodDate);
        apiEndDate = endOfMonth(periodDate);
        break;
      case "4": // Yearly
        apiStartDate = startOfYear(periodDate);
        apiEndDate = endOfYear(periodDate);
        break;
      default:
        apiStartDate = periodDate;
        apiEndDate = periodDate;
    }
    
    try {
      const data = await getHistoricalEnergyData(apiKey, inverterSerial, apiStartDate, apiEndDate, parseInt(selectedGrouping, 10));
      setHistoricalData(data);
      if (data.length === 0 && !error) { 
        toast({ title: "No Data", description: "No historical data found for the selected period and granularity."});
      }
    } catch (e: any) {
      console.error("Error fetching historical data:", e);
      setError(e.message || "Failed to fetch historical data.");
      setHistoricalData([]);
      toast({ variant: "destructive", title: "Fetch Error", description: e.message || "Could not load historical data."});
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, inverterSerial, periodDate, selectedGrouping, toast]); 

  useEffect(() => {
    if (apiKey && inverterSerial && !isLoadingApiKey) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, inverterSerial, isLoadingApiKey, fetchData]);

  const formattedChartData = historicalData.map(item => {
    const parsedDate = parseISO(item.date);
    let label = format(parsedDate, "MMM d"); // Default for Daily (grouping "1")
    if (selectedGrouping === "2") { // Weekly
      label = `W/O ${format(parsedDate, "MMM d")}`; 
    } else if (selectedGrouping === "3") { // Monthly
      label = format(parsedDate, "MMM yyyy");
    } else if (selectedGrouping === "4") { // Yearly
      label = format(parsedDate, "yyyy");
    }
    return {
      ...item,
      shortDate: label,
    };
  });
  
  const DailyEnergyOverviewChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={formattedChartData}>
        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
        <XAxis dataKey="shortDate" />
        <YAxis yAxisId="left" label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
        <Tooltip 
          formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name.replace(/([A-Z])/g, ' $1').trim()]} 
          labelFormatter={(label: string) => `Period: ${label}`}
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

  const currentGroupingOption = groupingOptions.find(opt => opt.value === selectedGrouping);

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
          <CardTitle>Report Options</CardTitle>
          <CardDescription>Select the granularity and date for the energy history report.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="grouping-select">Report Granularity</Label>
            <Select
              value={selectedGrouping}
              onValueChange={(value) => setSelectedGrouping(value as GroupingOptionValue)}
            >
              <SelectTrigger id="grouping-select" className="w-full">
                <SelectValue placeholder="Select granularity" />
              </SelectTrigger>
              <SelectContent>
                {groupingOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-date">{currentGroupingOption?.datePickerLabel || "Select Date"}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="period-date" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateForDisplay(periodDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={periodDate} onSelect={setPeriodDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={() => fetchData()} disabled={loading || !apiKey || !inverterSerial || !periodDate} className="w-full sm:w-auto md:self-end">
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
                <CardTitle className="flex items-center"><HomeIcon className="mr-2 h-5 w-5 text-primary"/>Energy Overview</CardTitle>
                <CardDescription>Summary of energy consumption and sources for the selected period and granularity.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <DailyEnergyOverviewChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><SunMedium className="mr-2 h-5 w-5 text-primary"/>Solar Generation Distribution</CardTitle>
                <CardDescription>How your generated solar energy was used.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <SolarDistributionChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><BatteryCharging className="mr-2 h-5 w-5 text-primary"/>Battery Usage Patterns</CardTitle>
                <CardDescription>Energy charged into and discharged from your battery.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px]">
                <BatteryUsageChart />
              </CardContent>
            </Card>
          </div>
        </>
      )}
      
      {!loading && !error && historicalData.length === 0 && apiKey && inverterSerial && periodDate && (
         <div className="text-center py-10 text-muted-foreground">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p>No data available for the selected period and granularity.</p>
            <p>Try adjusting the date or click "Fetch History" again.</p>
        </div>
      )}
    </div>
  );
}

