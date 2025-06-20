
"use client";

import * as React from 'react';
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { getEnergyFlows } from "@/lib/givenergy"; // Corrected: Now imports from givenergy.ts
import type { EnergyFlowRawEntry, ProcessedEnergyFlowDataPoint, GroupingOptionConfig, EnergyFlowTypeID } from "@/lib/types";
import { ENERGY_FLOW_TYPE_DETAILS as FLOW_DETAILS_MAP } from "@/lib/types";
import { format, subDays, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, subMonths, getYear, isValid, differenceInDays, parseISO, addDays } from "date-fns";
import { ArrowLeft, CalendarIcon, Loader2, AlertTriangle, BarChart3, InfoIcon, HelpCircle, BarChartHorizontalBig } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { useTheme } from "@/hooks/use-theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EnergyFlowSummaryCard } from "@/components/history/EnergyFlowSummaryCard";


const formatDateForDisplay = (date: Date | undefined): string => {
 return date ? format(date, "PPP") : "Pick a date";
};

const formatMonthForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "MMMM yyyy") : "Select Month";
};

const formatYearForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "yyyy") : "Select Year";
};

const MAX_DATE_RANGE_DAYS = 366;

const groupingOptions: GroupingOptionConfig[] = [
  // { id: "half_hourly", label: "Half-Hourly", apiValue: 0, datePickerType: 'single_day_half_hourly' }, // Removed as requested
  { id: "daily", label: "Daily", apiValue: 1, datePickerType: 'single_day_daily' },
  { id: "weekly", label: "Weekly (Aggregated Daily)", apiValue: 1, datePickerType: 'week_daily' },
  { id: "monthly", label: "Monthly", apiValue: 2, datePickerType: 'month_monthly' },
  { id: "yearly", label: "Yearly", apiValue: 3, datePickerType: 'year_yearly' },
  { id: "total", label: "Total / All Time", apiValue: 4, datePickerType: 'all_time_total' },
  { id: "custom_daily", label: "Custom Range (Daily)", apiValue: 1, datePickerType: 'custom_range_daily' },
];

const ALL_FLOW_TYPE_IDS = Object.keys(FLOW_DETAILS_MAP) as EnergyFlowTypeID[];

const generateMonthOptions = () => {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 36; i++) {
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
    for (let i = 0; i < 20; i++) {
        const year = currentYear - i;
        options.push({
            label: String(year),
            value: startOfYear(new Date(year, 0, 1)).toISOString(),
        });
    }
    return options;
};


export default function EnergyHistoryPage() {
  const { apiKey, inverterSerial, isLoadingApiKey } = useApiKey();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [selectedGroupingId, setSelectedGroupingId] = useState<string>(groupingOptions[0].id); // Default to Daily

  const [date1, setDate1] = useState<Date | undefined>(new Date());
  const [date2, setDate2] = useState<Date | undefined>(new Date());

  const [selectedFlowTypeIDs, setSelectedFlowTypeIDs] = useState<EnergyFlowTypeID[]>(ALL_FLOW_TYPE_IDS);

  const [flowData, setFlowData] = useState<ProcessedEnergyFlowDataPoint[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallbackRange, setUsedFallbackRange] = useState<boolean>(false);


  const monthOptions = React.useMemo(() => generateMonthOptions(), []);
  const yearOptions = React.useMemo(() => generateYearOptions(), []);

  const currentGroupingConfig = useMemo(() => {
    return groupingOptions.find(opt => opt.id === selectedGroupingId) || groupingOptions[0];
  }, [selectedGroupingId]);


  const handleFlowTypeChange = (typeId: EnergyFlowTypeID, checked: boolean) => {
    setSelectedFlowTypeIDs(prev =>
      checked ? [...prev, typeId] : prev.filter(id => id !== typeId)
    );
  };

  const handleSelectAllFlowTypes = (checked: boolean) => {
    setSelectedFlowTypeIDs(checked ? ALL_FLOW_TYPE_IDS : []);
  };

  const parseApiTimestamp = (apiTimestamp: string): Date => {
    let parsed = parse(apiTimestamp, "yyyy-MM-dd HH:mm", new Date());
    if (!isValid(parsed)) {
      parsed = parse(apiTimestamp, "yyyy-MM-dd", new Date());
    }
    if (!isValid(parsed)) {
      console.warn(`Could not parse API timestamp: ${apiTimestamp}. Using current date as fallback.`);
      return new Date();
    }
    return parsed;
  };


  const transformData = useCallback((rawData: EnergyFlowRawEntry[]): ProcessedEnergyFlowDataPoint[] => {
    if (!rawData || rawData.length === 0 || (Object.keys(rawData).length === 0 && typeof rawData === 'object' && !Array.isArray(rawData))) {
        return [];
    }


    return rawData.map(entry => {
      let timeLabel = "";
      const startDate = parseApiTimestamp(entry.start_time);
      const endDate = parseApiTimestamp(entry.end_time);

      switch (currentGroupingConfig.apiValue) {
        case 0: // This case is effectively unused now that Half-Hourly is removed, but kept for structural integrity if re-added
          timeLabel = `${format(startDate, "HH:mm")}`;
          break;
        case 1:
          timeLabel = format(startDate, "MMM d, yy");
          break;
        case 2:
          timeLabel = format(startDate, "MMM yyyy");
          break;
        case 3:
          timeLabel = format(startDate, "yyyy");
          break;
        case 4:
          timeLabel = `Total (${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yy")})`;
          break;
        default:
          timeLabel = entry.start_time;
      }

      const processedValues: ProcessedEnergyFlowDataPoint['values'] = {};
      for (const typeId of ALL_FLOW_TYPE_IDS) {
        if (entry.data[typeId] !== undefined) {
          processedValues[typeId] = parseFloat(entry.data[typeId].toFixed(2));
        }
      }

      return {
        startTimeOriginal: entry.start_time,
        endTimeOriginal: entry.end_time,
        timeLabel,
        values: processedValues,
      };
    });
  }, [currentGroupingConfig.apiValue]);


  const fetchData = useCallback(async () => {
    console.log("[HistoryPage] fetchData called. selectedFlowTypeIDs:", selectedFlowTypeIDs);
    console.log("[HistoryPage] currentGroupingConfig:", currentGroupingConfig);
    console.log("[HistoryPage] date1:", date1, "date2:", date2);

    if (!apiKey || !inverterSerial) {
      setError("API key or inverter serial not set. Please check settings.");
      setFlowData([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setError(null);
    setUsedFallbackRange(false);

    let initialApiStartDateStr: string;
    let initialApiEndDateStrForQuery: string;
    const today = new Date();

    switch (currentGroupingConfig.datePickerType) {
      case 'single_day_half_hourly': // Maintained for structure, though option removed
        if (!date1) { setError("Please select a day."); setIsLoadingData(false); return; }
        initialApiStartDateStr = format(date1, "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(date1, "yyyy-MM-dd");
        break;
      case 'single_day_daily':
        if (!date1) { setError("Please select a day."); setIsLoadingData(false); return; }
        initialApiStartDateStr = format(date1, "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(date1, "yyyy-MM-dd");
        break;
      case 'week_daily':
        if (!date1) { setError("Please select a day in the target week."); setIsLoadingData(false); return; }
        const weekStart = startOfWeek(date1, { weekStartsOn: 1 });
        initialApiStartDateStr = format(weekStart, "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(addDays(endOfWeek(date1, { weekStartsOn: 1 }), 1), "yyyy-MM-dd");
        break;
      case 'month_monthly':
        if (!date1) { setError("Please select a month."); setIsLoadingData(false); return; }
        initialApiStartDateStr = format(startOfMonth(date1), "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(endOfMonth(date1), "yyyy-MM-dd");
        break;
      case 'year_yearly':
        if (!date1) { setError("Please select a year."); setIsLoadingData(false); return; }
        initialApiStartDateStr = format(startOfYear(date1), "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(endOfYear(date1), "yyyy-MM-dd");
        break;
      case 'all_time_total':
        initialApiStartDateStr = format(subYears(today, 20), "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(today, "yyyy-MM-dd");
        break;
      case 'custom_range_daily':
        if (!date1 || !date2) { setError("Please select a start and end date for the custom range."); setIsLoadingData(false); return; }
        if (date2 < date1) { setError("End date cannot be before start date."); setIsLoadingData(false); return; }
        if (differenceInDays(date2, date1) > MAX_DATE_RANGE_DAYS) {
            setError(`Custom date range cannot exceed ${MAX_DATE_RANGE_DAYS} days for daily data. Please select a shorter range.`);
            setIsLoadingData(false);
            return;
        }
        initialApiStartDateStr = format(date1, "yyyy-MM-dd");
        initialApiEndDateStrForQuery = format(addDays(date2, 1), "yyyy-MM-dd");
        break;
      default:
        setError("Invalid date picker type.");
        setIsLoadingData(false);
        return;
    }

    let dataToSet: ProcessedEnergyFlowDataPoint[] = [];

    try {
      console.log("[HistoryPage] Attempting initial fetch with start:", initialApiStartDateStr, "end:", initialApiEndDateStrForQuery, "grouping:", currentGroupingConfig.apiValue);
      const rawData = await getEnergyFlows(apiKey!, inverterSerial!, initialApiStartDateStr, initialApiEndDateStrForQuery, currentGroupingConfig.apiValue, selectedFlowTypeIDs);
      let transformed = transformData(rawData);
      dataToSet = transformed;

      if (transformed.length === 0 && currentGroupingConfig.datePickerType === 'single_day_daily' && date1) {
        console.warn("[HistoryPage] Initial fetch empty for single_day_daily. Trying fallback range (D-3 to D+3).");
        setUsedFallbackRange(true);

        const fallbackStartDate = subDays(date1, 3);
        const fallbackEndDateInclusive = addDays(date1, 3);

        const fallbackApiQueryStartDateStr = format(fallbackStartDate, "yyyy-MM-dd");
        const fallbackApiQueryEndDateStr = format(addDays(fallbackEndDateInclusive, 1), "yyyy-MM-dd");

        console.log("[HistoryPage] Attempting fallback fetch with start:", fallbackApiQueryStartDateStr, "end:", fallbackApiQueryEndDateStr, "grouping:", currentGroupingConfig.apiValue);
        const fallbackRawData = await getEnergyFlows(apiKey!, inverterSerial!, fallbackApiQueryStartDateStr, fallbackApiQueryEndDateStr, currentGroupingConfig.apiValue, selectedFlowTypeIDs);
        transformed = transformData(fallbackRawData);
        dataToSet = transformed;

        if (transformed.length > 0) {
          toast({ title: "Fallback Data Used", description: "Initial daily data was empty, showing data for a 7-day period around the selected date." });
        }
      }

      setFlowData(dataToSet);

      if (dataToSet.length === 0 && selectedFlowTypeIDs.length > 0) {
        toast({ title: "No Data Found", description: "No energy flow data available for the selected criteria." });
      }
    } catch (e: any) {
      console.error("Error fetching energy flows:", e);
      setError(e.message || "Failed to fetch energy flow data.");
      setFlowData([]);
      toast({ variant: "destructive", title: "Fetch Error", description: e.message || "Could not load energy flow data." });
    } finally {
      setIsLoadingData(false);
    }
  }, [apiKey, inverterSerial, currentGroupingConfig, date1, date2, selectedFlowTypeIDs, transformData, toast]);


  const filteredFlowDataForDisplay = useMemo(() => {
    if (selectedGroupingId === 'daily' && date1) {
      const selectedDayString = format(date1, "yyyy-MM-dd");
      return flowData.filter(entry => entry.startTimeOriginal.startsWith(selectedDayString));
    }
    // For other groupings, or if date1 is not set for daily, use the raw flowData
    return flowData;
  }, [flowData, selectedGroupingId, date1]);


  const chartData = useMemo(() => {
    return filteredFlowDataForDisplay.map(entry => {
      const chartEntry: any = { timeLabel: entry.timeLabel };
      selectedFlowTypeIDs.forEach(typeId => {
        chartEntry[typeId] = entry.values[typeId] || 0;
      });
      return chartEntry;
    });
  }, [filteredFlowDataForDisplay, selectedFlowTypeIDs]);

  const tableColumns = useMemo(() => {
    const timeCols = [
        { Header: 'Start Time', accessor: 'startTimeOriginal' },
        { Header: 'End Time', accessor: 'endTimeOriginal' }
    ];
    // For non-half-hourly, only show one date/period column.
    if (currentGroupingConfig.apiValue !== 0) { // 0 was half-hourly
        timeCols.splice(1,1); // Remove end time column
        timeCols[0].Header = "Period"; // Rename start time to Period
    }


    const flowCols = selectedFlowTypeIDs.map(typeId => ({
      Header: () => (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center cursor-help">
                {FLOW_DETAILS_MAP[typeId].name}
                <HelpCircle className="ml-1 h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>{FLOW_DETAILS_MAP[typeId].description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ),
      accessor: `values.${typeId}`,
    }));
    return [...timeCols, ...flowCols];
  }, [selectedFlowTypeIDs, currentGroupingConfig.apiValue]);


  const renderDatePicker = () => {
    switch (currentGroupingConfig.datePickerType) {
      case 'single_day_half_hourly': // Maintained for structure, though option removed
      case 'single_day_daily':
      case 'week_daily':
        return (
          <div className="space-y-1">
            <Label htmlFor="single-date-picker">Select Day</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button id="single-date-picker" variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateForDisplay(date1)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date1} onSelect={setDate1} initialFocus /></PopoverContent>
            </Popover>
          </div>
        );
      case 'month_monthly':
        return (
          <div className="space-y-1">
            <Label htmlFor="month-select">Select Month</Label>
            <Select value={date1 ? startOfMonth(date1).toISOString() : ""} onValueChange={(iso) => setDate1(iso ? parseISO(iso) : undefined)}>
              <SelectTrigger id="month-select"><SelectValue placeholder={formatMonthForDisplay(date1) || "Select Month"} /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      case 'year_yearly':
        return (
          <div className="space-y-1">
            <Label htmlFor="year-select">Select Year</Label>
            <Select value={date1 ? startOfYear(date1).toISOString() : ""} onValueChange={(iso) => setDate1(iso ? parseISO(iso) : undefined)}>
              <SelectTrigger id="year-select"><SelectValue placeholder={formatYearForDisplay(date1) || "Select Year"} /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      case 'custom_range_daily':
        return (
          <>
            <div className="space-y-1">
              <Label htmlFor="custom-start-date">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="custom-start-date" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />{formatDateForDisplay(date1)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date1} onSelect={setDate1} initialFocus /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label htmlFor="custom-end-date">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="custom-end-date" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />{formatDateForDisplay(date2)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date2} onSelect={setDate2} disabled={(d) => (date1 && d < date1) || false} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </>
        );
      case 'all_time_total':
      default:
        return null;
    }
  };

  const allFlowTypesSelected = selectedFlowTypeIDs.length === ALL_FLOW_TYPE_IDS.length;

  return (
    <div className="w-full space-y-6 py-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl flex items-center">
          <BarChart3 className="mr-3 h-8 w-8 text-primary" />
          Energy Flow History
        </h1>
        <Button variant="default" asChild style={{ borderColor: '#ff8c00', color: '#ff8c00' }}>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
          <CardDescription>Select grouping, date range, and energy flow types for the report.</CardDescription>
          {inverterSerial && <p className="text-xs text-muted-foreground pt-1">Querying Inverter: {inverterSerial}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="grouping-select">Grouping Interval</Label>
              <Select value={selectedGroupingId} onValueChange={(value) => {
                  setSelectedGroupingId(value);
                  const newConf = groupingOptions.find(opt => opt.id === value);
                  if (newConf && newConf.datePickerType !== currentGroupingConfig.datePickerType) {
                      setDate1(new Date());
                      setDate2(new Date());
                  }
              }}>
                <SelectTrigger id="grouping-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groupingOptions.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {renderDatePicker()}
            <Button onClick={fetchData} disabled={isLoadingData || !apiKey || !inverterSerial} className="w-full md:w-auto md:self-end">
              {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Fetch Energy Flows"}
            </Button>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Select Energy Flow Types:</Label>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="select-all-flow-types"
                        checked={allFlowTypesSelected}
                        onCheckedChange={handleSelectAllFlowTypes}
                    />
                    <Label htmlFor="select-all-flow-types" className="font-normal">Select All</Label>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              {ALL_FLOW_TYPE_IDS.map(typeId => (
                <div key={typeId} className="flex items-center space-x-2">
                  <Checkbox
                    id={`flow-type-${typeId}`}
                    checked={selectedFlowTypeIDs.includes(typeId)}
                    onCheckedChange={(checked) => handleFlowTypeChange(typeId, !!checked)}
                  />
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor={`flow-type-${typeId}`} className="font-normal cursor-help flex items-center">
                          {FLOW_DETAILS_MAP[typeId].name}
                          <HelpCircle className="ml-1.5 h-3.5 w-3.5 text-muted-foreground opacity-70" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>{FLOW_DETAILS_MAP[typeId].description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {usedFallbackRange && (
        <Alert variant="default" className="mt-4">
 <InfoIcon className="h-4 w-4" />
 <AlertTitle>Unable to give Summary for a single day, as this is the same as Energy Flow Data Table.</AlertTitle>
 <AlertDescription>
            Displaying data for a 7-day period around that date instead.
          </AlertDescription>
        </Alert>
      )}

      {isLoadingApiKey && (
         <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" /> <p>Loading API Key...</p>
        </div>
      )}
      {!apiKey && !isLoadingApiKey && (
        <Alert variant="default"><AlertTriangle className="h-4 w-4" /><AlertTitle>API Key Required</AlertTitle><AlertDescription>Please set your GivEnergy API key in settings.</AlertDescription></Alert>
      )}
      {!inverterSerial && apiKey && !isLoadingApiKey && (
         <Alert variant="default"><AlertTriangle className="h-4 w-4" /><AlertTitle>Inverter Serial Missing</AlertTitle><AlertDescription>Could not determine inverter serial. Check API key permissions.</AlertDescription></Alert>
      )}

      {isLoadingData && (
        <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" /> <p>Loading energy flow data...</p>
        </div>
      )}
      {error && !isLoadingData && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {!isLoadingData && !error && flowData.length > 0 && apiKey && inverterSerial && (
        <>
          <EnergyFlowSummaryCard
            flowData={flowData}
 selectedGroupingId={selectedGroupingId}
 selectedFlowTypeIDs={selectedFlowTypeIDs}
            groupingLabel={currentGroupingConfig.label}
          />
          <Card>
            <CardHeader>
              <CardTitle>Energy Flow Chart</CardTitle>
              <CardDescription>Stacked bar chart of selected energy flows (kWh).</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px] p-2 sm:p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                  <XAxis dataKey="timeLabel" angle={-30} textAnchor="end" height={70} interval={chartData.length > 30 ? Math.floor(chartData.length / 15) : 0} tick={{ fontSize: 11 }} />
                  <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
                  <RechartsTooltip
                    formatter={(value: number, name: EnergyFlowTypeID) => [`${value.toFixed(2)} kWh`, FLOW_DETAILS_MAP[name]?.name || name]}
                    labelFormatter={(label: string) => `Period: ${label}`}
                  />
                  <Legend wrapperStyle={{paddingTop: '20px'}} formatter={(value: EnergyFlowTypeID) => FLOW_DETAILS_MAP[value]?.name || value } />
                  {selectedFlowTypeIDs.map((typeId) => (
                    <Bar key={typeId} dataKey={typeId} stackId="a" fill={FLOW_DETAILS_MAP[typeId]?.color || '#8884d8'} name={FLOW_DETAILS_MAP[typeId]?.name} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Energy Flow Data Table</CardTitle>
              <CardDescription>Detailed energy flow values (kWh) for each interval.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map((col, index) => (
                      <TableHead key={index}>{typeof col.Header === 'function' ? col.Header({}) : col.Header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlowDataForDisplay.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {tableColumns.map((col, colIndex) => {
                        let cellValue: any = row[col.accessor as keyof ProcessedEnergyFlowDataPoint];
                        if (col.accessor.startsWith('values.')) {
                            const typeId = col.accessor.split('.')[1] as EnergyFlowTypeID;
                            cellValue = row.values[typeId];
                        } else if (col.accessor === 'startTimeOriginal' && currentGroupingConfig.apiValue !== 0) { // 0 was half-hourly
                             cellValue = row.timeLabel;
                        }

                        return (
                            <TableCell key={colIndex}>
                            {cellValue !== undefined && cellValue !== null ? (typeof cellValue === 'number' ? cellValue.toFixed(2) : String(cellValue)) : 'N/A'}
                            </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
                 {flowData.length === 0 && <TableCaption>No data to display for the current selection.</TableCaption>}
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {!isLoadingData && !error && flowData.length === 0 && apiKey && inverterSerial && (
         <Card className="mt-6"><CardContent className="pt-6 text-center text-muted-foreground">No energy flow data found for the selected criteria. The inverter may have been offline or not reporting during this time.</CardContent></Card>
      )}
       {!isLoadingData && !error && selectedFlowTypeIDs.length === 0 && apiKey && inverterSerial && (
         <Card className="mt-6"><CardContent className="pt-6 text-center text-muted-foreground">Select flow types and click "Fetch Energy Flows" to see data. Leaving all unchecked will attempt to fetch all types.</CardContent></Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center text-base"><InfoIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Important Notes</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Indicative Values:</strong> Energy flow readings are calculated and indicative. They should not replace official meter readings.</p>
            <p><strong>Data Duplication:</strong> Energy might be counted twice in some scenarios (e.g., PV to Battery, then Battery to Grid).</p>
            <p><strong>Data Gaps:</strong> Data may be lower if the inverter was offline for 30+ minutes.</p>
            <p><strong>Timestamps:</strong> Times are based on the inverter's local time. Data might be interpolated to 30-minute intervals depending on your GivEnergy account settings for the device.</p>
        </CardContent>
      </Card>
    </div>
  );
}
