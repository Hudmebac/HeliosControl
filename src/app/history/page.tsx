
"use client";

import * as React from 'react'; 
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
import { format, subDays, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, getYear } from "date-fns";
import { ArrowLeft, CalendarIcon, Loader2, AlertTriangle, BarChart3, HomeIcon, SunMedium, BatteryCharging } from "lucide-react";
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formatDateForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "PPP") : "Pick a date";
};

const formatMonthForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "MMMM yyyy") : "Select Month";
};

const formatYearForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "yyyy") : "Select Year";
};

type GroupingOptionValue = "1" | "2" | "3" | "4" | "5" | "6";
type DatePickerType = 'calendar' | 'month_select' | 'year_select' | 'range' | 'none';

interface GroupingOption {
  value: GroupingOptionValue;
  label: string;
  apiGroupingValue: number;
  datePickerLabel?: string;
  datePickerType: DatePickerType;
}

const groupingOptions: GroupingOption[] = [
  { value: "1", label: "Daily", apiGroupingValue: 1, datePickerLabel: "Select Day", datePickerType: 'calendar' },
  { value: "2", label: "Weekly", apiGroupingValue: 2, datePickerLabel: "Select Day in Target Week", datePickerType: 'calendar' },
  { value: "3", label: "Monthly", apiGroupingValue: 3, datePickerLabel: "Select Month", datePickerType: 'month_select' },
  { value: "4", label: "Yearly", apiGroupingValue: 4, datePickerLabel: "Select Year", datePickerType: 'year_select' },
  { value: "5", label: "All Time", apiGroupingValue: 4, datePickerType: 'none' }, // API grouping 4 for yearly data
  { value: "6", label: "Custom Range", apiGroupingValue: 1, datePickerType: 'range' }, // API grouping 1 for daily data
];

const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 24; i++) { 
    const date = subMonths(today, i);
    options.push({
      label: format(date, "MMMM yyyy"),
      value: startOfMonth(date).toISOString(),
    });
  }
  return options;
};

const generateYearOptions = () => {
    const options = [];
    const currentYear = getYear(new Date());
    for (let i = 0; i < 20; i++) { // Generate current year and previous 19 years
        const year = currentYear - i;
        options.push({
            label: String(year),
            value: startOfYear(new Date(year, 0, 1)).toISOString(),
        });
    }
    return options;
};


export default function HistoryPage() {
  const { apiKey, inverterSerial, isLoadingApiKey } = useApiKey();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [selectedGrouping, setSelectedGrouping] = useState<GroupingOptionValue>("1");
  const [periodDate, setPeriodDate] = useState<Date | undefined>(new Date());
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(new Date());
  
  const [historicalData, setHistoricalData] = useState<HistoricalEnergyDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = React.useMemo(() => generateMonthOptions(), []);
  const yearOptions = React.useMemo(() => generateYearOptions(), []);

  const solarColor = "hsl(var(--chart-1))";
  const gridImportColor = "hsl(var(--chart-2))";
  const batteryDischargeColor = "hsl(var(--chart-3))";
  const batteryChargeColor = "hsl(var(--chart-4))";
  const consumptionColor = "hsl(var(--chart-5))";


  const fetchData = useCallback(async () => {
    if (!apiKey || !inverterSerial) {
      setError("API key or inverter serial not set.");
      setHistoricalData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const currentGroupingDetails = groupingOptions.find(opt => opt.value === selectedGrouping);
    if (!currentGroupingDetails) {
      setError("Invalid grouping selected.");
      setLoading(false);
      return;
    }

    let apiStartDate: Date;
    let apiEndDate: Date;
    const apiGrouping = currentGroupingDetails.apiGroupingValue;

    switch (currentGroupingDetails.datePickerType) {
      case "calendar":
      case "month_select":
      case "year_select":
        if (!periodDate) { setError("Please select a period."); setLoading(false); return; }
        if (selectedGrouping === "1") { // Daily
          apiStartDate = periodDate;
          apiEndDate = periodDate;
        } else if (selectedGrouping === "2") { // Weekly
          apiStartDate = startOfWeek(periodDate, { weekStartsOn: 1 });
          apiEndDate = endOfWeek(periodDate, { weekStartsOn: 1 });
        } else if (selectedGrouping === "3") { // Monthly
          apiStartDate = startOfMonth(periodDate);
          apiEndDate = endOfMonth(periodDate);
        } else if (selectedGrouping === "4") { // Yearly
          apiStartDate = startOfYear(periodDate);
          apiEndDate = endOfYear(periodDate);
        } else {
            setError("Invalid period selection for chosen report type."); setLoading(false); return;
        }
        break;
      case "none": // All Time (fetch yearly data from a very early date)
        apiStartDate = new Date('2000-01-01'); 
        apiEndDate = new Date(); 
        break;
      case "range": 
        if (!customStartDate || !customEndDate) { setError("Please select a start and end date."); setLoading(false); return; }
        if (customEndDate < customStartDate) { setError("End date cannot be before start date."); setLoading(false); return; }
        apiStartDate = customStartDate;
        apiEndDate = customEndDate;
        break;
      default:
        setError("Invalid grouping or date picker type configuration.");
        setLoading(false);
        return;
    }
    
    try {
      const data = await getHistoricalEnergyData(apiKey, inverterSerial, apiStartDate, apiEndDate, apiGrouping);
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
  }, [apiKey, inverterSerial, periodDate, customStartDate, customEndDate, selectedGrouping, toast, error]); 

  useEffect(() => {
    if (apiKey && inverterSerial && !isLoadingApiKey) {
      fetchData();
    }
  }, [apiKey, inverterSerial, isLoadingApiKey, fetchData]);

  const formattedChartData = historicalData.map(item => {
    const parsedDate = parseISO(item.date); 
    let label = "";
    const currentApiGrouping = groupingOptions.find(opt => opt.value === selectedGrouping)?.apiGroupingValue || 1;

    if (currentApiGrouping === 1) label = format(parsedDate, "MMM d, yy"); 
    else if (currentApiGrouping === 2) label = `W/C ${format(parsedDate, "MMM d, yy")}`; 
    else if (currentApiGrouping === 3) label = format(parsedDate, "MMM yyyy"); 
    else if (currentApiGrouping === 4) label = format(parsedDate, "yyyy"); 
    else label = format(parsedDate, "MMM d, yy"); 

    return {
      ...item,
      shortDate: label,
    };
  });
  
  const EnergyOverviewChart = () => (
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
        <Bar yAxisId="left" dataKey="batteryDischarge" name="Battery Discharge" fill={batteryDischargeColor} stackId="a" />
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

  const currentGroupingDetails = groupingOptions.find(opt => opt.value === selectedGrouping);
  const disableFetchButton = loading || !apiKey || !inverterSerial ||
    (currentGroupingDetails?.datePickerType === 'calendar' && !periodDate) ||
    (currentGroupingDetails?.datePickerType === 'month_select' && !periodDate) ||
    (currentGroupingDetails?.datePickerType === 'year_select' && !periodDate) ||
    (currentGroupingDetails?.datePickerType === 'range' && (!customStartDate || !customEndDate));


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
          <CardTitle>Generate a Report</CardTitle>
          <CardDescription>Select report type and date(s) for the energy history.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <Label htmlFor="grouping-select">Report Type</Label>
            <Select
              value={selectedGrouping}
              onValueChange={(value) => {
                setSelectedGrouping(value as GroupingOptionValue);
                const newGroupingType = groupingOptions.find(opt => opt.value === value)?.datePickerType;
                if (newGroupingType !== 'month_select' && newGroupingType !== 'year_select' && newGroupingType !== 'calendar') {
                    setPeriodDate(new Date()); 
                } else if (newGroupingType === 'month_select' && periodDate && format(periodDate, 'yyyy-MM-dd') !== format(startOfMonth(periodDate), 'yyyy-MM-dd')) {
                    setPeriodDate(startOfMonth(new Date())); 
                } else if (newGroupingType === 'year_select' && periodDate && format(periodDate, 'yyyy-MM-dd') !== format(startOfYear(periodDate), 'yyyy-MM-dd')) {
                    setPeriodDate(startOfYear(new Date()));
                } else if (!periodDate) { 
                    setPeriodDate(new Date());
                }
                setError(null); 
              }}
            >
              <SelectTrigger id="grouping-select" className="w-full">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {groupingOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentGroupingDetails?.datePickerType === 'calendar' && (
            <div className="space-y-1">
              <Label htmlFor="period-date">{currentGroupingDetails.datePickerLabel || "Select Date"}</Label>
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
          )}

          {currentGroupingDetails?.datePickerType === 'month_select' && (
            <div className="space-y-1">
              <Label htmlFor="month-select">{currentGroupingDetails.datePickerLabel || "Select Month"}</Label>
              <Select
                value={periodDate ? startOfMonth(periodDate).toISOString() : ""}
                onValueChange={(isoDateString) => {
                  if (isoDateString) {
                    setPeriodDate(parseISO(isoDateString));
                  } else {
                    setPeriodDate(undefined); 
                  }
                }}
              >
                <SelectTrigger id="month-select" className="w-full">
                  <SelectValue placeholder="Select month">
                    {periodDate ? formatMonthForDisplay(periodDate) : "Select Month"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {currentGroupingDetails?.datePickerType === 'year_select' && (
            <div className="space-y-1">
              <Label htmlFor="year-select">{currentGroupingDetails.datePickerLabel || "Select Year"}</Label>
              <Select
                value={periodDate ? startOfYear(periodDate).toISOString() : ""}
                onValueChange={(isoDateString) => {
                  if (isoDateString) {
                    setPeriodDate(parseISO(isoDateString));
                  } else {
                    setPeriodDate(undefined);
                  }
                }}
              >
                <SelectTrigger id="year-select" className="w-full">
                  <SelectValue placeholder="Select year">
                    {periodDate ? formatYearForDisplay(periodDate) : "Select Year"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentGroupingDetails?.datePickerType === 'range' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="custom-start-date">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="custom-start-date" variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formatDateForDisplay(customStartDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={customStartDate} onSelect={setCustomStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-end-date">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="custom-end-date" variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formatDateForDisplay(customEndDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={customEndDate} onSelect={setCustomEndDate} disabled={(date) => customStartDate && date < customStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
          
          <div className={`flex items-end ${currentGroupingDetails?.datePickerType === 'range' ? 'lg:col-span-3' : (currentGroupingDetails?.datePickerType === 'none' ? 'md:col-start-2 lg:col-start-3' : '')}`}>
            <Button onClick={() => fetchData()} disabled={disableFetchButton} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fetch History"}
            </Button>
          </div>
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
              <CardContent className="h-[450px] p-2 sm:p-4"> 
                <EnergyOverviewChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><SunMedium className="mr-2 h-5 w-5 text-primary"/>Solar Generation Distribution</CardTitle>
                <CardDescription>How your generated solar energy was used.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px] p-2 sm:p-4">
                <SolarDistributionChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><BatteryCharging className="mr-2 h-5 w-5 text-primary"/>Battery Usage Patterns</CardTitle>
                <CardDescription>Energy charged into and discharged from your battery.</CardDescription>
              </CardHeader>
              <CardContent className="h-[450px] p-2 sm:p-4">
                <BatteryUsageChart />
              </CardContent>
            </Card>
          </div>
        </>
      )}
      
      {!loading && !error && historicalData.length === 0 && apiKey && inverterSerial && (
        (currentGroupingDetails?.datePickerType === 'calendar' && !periodDate) ||
        (currentGroupingDetails?.datePickerType === 'month_select' && !periodDate) ||
        (currentGroupingDetails?.datePickerType === 'year_select' && !periodDate) ||
        (currentGroupingDetails?.datePickerType === 'range' && (!customStartDate || !customEndDate))
      ) ? (
        <div className="text-center py-10 text-muted-foreground">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p>Please select a date or date range for the chosen report type.</p>
        </div>
      ) : (
         !loading && !error && historicalData.length === 0 && apiKey && inverterSerial &&
         <div className="text-center py-10 text-muted-foreground">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p>No data available for the selected period and granularity.</p>
            <p>Try adjusting the date/range or click "Fetch History" again.</p>
        </div>
      )}
    </div>
  );
}

