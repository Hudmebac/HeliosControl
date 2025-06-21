
"use client";

import * as React from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parse, setHours, setMinutes, setSeconds, isWithinInterval, addDays, subMonths, parseISO } from 'date-fns';
import Link from "next/link";
import { useState, useCallback, useMemo, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { getEnergyFlows } from "@/lib/givenergy";
import type { EnergyFlowRawEntry } from '@/lib/types';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plug, CalendarIcon, Loader2, PlusCircle, Trash2, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Data Structures ---
interface TariffRate {
  id: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  rate: string;      // pence per kWh
  label?: string;    // Optional label like "Cheap"
}

interface CalculationResult {
  totalImportKWh: number;
  totalExportKWh: number;
  importCost: number;
  exportRevenue: number;
  netCost: number;
  effectiveImportRate: number;
  effectiveExportRate: number;
  period: string;
}

const TARIFF_PRESETS = [
    {
      provider: "Octopus Energy",
      name: "Cosy Home",
      rates: [
        { "start": "00:00", "end": "04:00", "rate": 27.24 },
        { "start": "04:00", "end": "07:00", "rate": 13.36, "label": "Cheap" },
        { "start": "07:00", "end": "13:00", "rate": 27.24 },
        { "start": "13:00", "end": "16:00", "rate": 13.36, "label": "Cheap" },
        { "start": "16:00", "end": "19:00", "rate": 40.86 },
        { "start": "19:00", "end": "22:00", "rate": 27.24 },
        { "start": "22:00", "end": "00:00", "rate": 13.36, "label": "Cheap" }
      ]
    },
    {
      provider: "Octopus Energy",
      name: "Go",
      rates: [
        { start: '00:30', end: '04:30', rate: 9.0, label: 'Cheap' },
        { start: '04:30', end: '00:30', rate: 28.0 },
      ],
    },
    {
      provider: "British Gas",
      name: "Electric Driver",
      rates: [
        { "start": "00:00", "end": "05:00", "rate": 8.95, "label": "Cheap" },
        { "start": "05:00", "end": "00:00", "rate": 32.00 }
      ]
    },
    {
      provider: "E.ON Next",
      name: "Drive",
      rates: [
        { "start": "00:00", "end": "07:00", "rate": 9.50, "label": "Cheap" },
        { "start": "07:00", "end": "00:00", "rate": 31.50 }
      ]
    },
    {
      provider: "EDF Energy",
      name: "GoElectric Overnight",
      rates: [
        { "start": "00:00", "end": "05:00", "rate": 8.00, "label": "Cheap" },
        { "start": "05:00", "end": "00:00", "rate": 33.00 }
      ]
    }
];

const formatDateForDisplay = (date: Date | undefined): string => {
 return date ? format(date, "PPP") : "Pick a date";
};

export default function TariffsPage() {
  const { apiKey, inverterSerial, isLoadingApiKey } = useApiKey();
  const { toast } = useToast();
  
  // State for date selections
  const [dailyDate, setDailyDate] = useState<Date | undefined>(new Date());
  const [weeklyDate, setWeeklyDate] = useState<Date | undefined>(new Date());
  const [activeTab, setActiveTab] = useState('day');

  // State for popover visibility
  const [isDailyCalendarOpen, setIsDailyCalendarOpen] = useState(false);
  const [isWeeklyCalendarOpen, setIsWeeklyCalendarOpen] = useState(false);

  // State for tariff setup and calculation results
  const [importRates, setImportRates] = useState<TariffRate[]>([
    { id: uuidv4(), startTime: '00:00', endTime: '23:59', rate: '28.0' },
  ]);
  const [exportRate, setExportRate] = useState<string>('15.0');
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // State for presets
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedTariffName, setSelectedTariffName] = useState<string>("");

  const availableProviders = useMemo(() => [...new Set(TARIFF_PRESETS.map(t => t.provider))], []);
  const availableTariffs = useMemo(() => TARIFF_PRESETS.filter(t => t.provider === selectedProvider), [selectedProvider]);

  const DEFAULT_TARIFF_STORAGE_KEY = "defaultTariff";

  // Load default tariff from local storage on mount
  useEffect(() => {
    const storedTariff = localStorage.getItem(DEFAULT_TARIFF_STORAGE_KEY);
    if (storedTariff) {
      try {
        const defaultTariff = JSON.parse(storedTariff);
        const tariff = TARIFF_PRESETS.find(t => t.provider === defaultTariff?.provider && t.name === defaultTariff?.name);
        if (tariff) {
          setSelectedProvider(defaultTariff.provider);
          setSelectedTariffName(defaultTariff.name);
          const newRates = tariff.rates.map(r => ({ id: uuidv4(), startTime: r.start, endTime: r.end, rate: String(r.rate) }));
          setImportRates(newRates);
        }
      } catch (e) {
        console.error("Error parsing default tariff from storage", e);
        localStorage.removeItem(DEFAULT_TARIFF_STORAGE_KEY);
      }
    }
  }, []);

  // --- Tariff Setup Handlers ---
  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedTariffName("");
    setImportRates([{ id: uuidv4(), startTime: '00:00', endTime: '23:59', rate: '28.0' }]);
  };

  const handleTariffChange = (tariffName: string) => {
    setSelectedTariffName(tariffName);
    const tariff = TARIFF_PRESETS.find(t => t.provider === selectedProvider && t.name === tariffName);
    if (tariff) {
        const newRates = tariff.rates.map(r => ({ id: uuidv4(), startTime: r.start, endTime: r.end, rate: String(r.rate), label: r.label }));
        setImportRates(newRates);
    }
  };

  const handleImportRateChange = (id: string, field: keyof Omit<TariffRate, 'id'>, value: string) => {
    setImportRates(prev => prev.map(rate => rate.id === id ? { ...rate, [field]: value } : rate));
  };

  const addImportRate = () => {
    setImportRates(prev => [...prev, { id: uuidv4(), startTime: '00:00', endTime: '23:59', rate: '' }]);
  };

  const removeImportRate = (id: string) => {
    if (importRates.length > 1) {
      setImportRates(prev => prev.filter(rate => rate.id !== id));
    } else {
      toast({ variant: "destructive", title: "Cannot Remove", description: "You must have at least one import rate period." });
    }
  };

  // --- Main Calculation Logic ---
  const calculateCosts = useCallback(async (startDate: Date, endDate: Date, periodLabel: string) => {
    if (!apiKey || !inverterSerial) {
      setError("API key or inverter serial not set. Please check settings.");
      return;
    }
    if (importRates.some(r => !r.rate || isNaN(parseFloat(r.rate))) || !exportRate || isNaN(parseFloat(exportRate))) {
      setError("Please ensure all tariff rates are valid numbers.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCalculationResult(null);

    if (saveAsDefault && selectedProvider && selectedTariffName) {
        localStorage.setItem(DEFAULT_TARIFF_STORAGE_KEY, JSON.stringify({ provider: selectedProvider, name: selectedTariffName }));
        toast({ title: "Default Tariff Saved", description: `${selectedProvider} - ${selectedTariffName} is now your default.` });
    }

    try {
      const apiStartDate = format(startDate, "yyyy-MM-dd");
      const apiEndDate = format(addDays(endDate, 1), "yyyy-MM-dd"); // API end date is exclusive

      const flowData = await getEnergyFlows(apiKey, inverterSerial, apiStartDate, apiEndDate, 0, ['2', '3', '4', '6']);

      if (flowData.length === 0) {
        toast({ title: "No Data", description: "No energy flow data was found for the selected date range." });
        setCalculationResult(null);
        return;
      }
      
      const sortedImportRates = [...importRates].sort((a, b) => parseInt(a.startTime.replace(':', ''), 10) - parseInt(b.startTime.replace(':', ''), 10));
      let totalImportKWh = 0, totalExportKWh = 0, totalImportCost = 0, totalExportRevenue = 0;

      flowData.forEach(entry => {
        const entryTime = parse(entry.start_time, 'yyyy-MM-dd HH:mm', new Date());
        const importKWh = (entry.data['3'] || 0) + (entry.data['4'] || 0);
        const exportKWh = (entry.data['2'] || 0) + (entry.data['6'] || 0);
        totalImportKWh += importKWh;
        totalExportKWh += exportKWh;
        
        let matchedRatePence = 0;
        for (const ratePeriod of sortedImportRates) {
            const [startH, startM] = ratePeriod.startTime.split(':').map(Number);
            const [endH, endM] = ratePeriod.endTime.split(':').map(Number);
            const periodStart = setSeconds(setMinutes(setHours(entryTime, startH), startM), 0);
            let periodEnd = setSeconds(setMinutes(setHours(entryTime, endH), endM), 59);

            if (periodEnd < periodStart) { // Overnight period
                if (isWithinInterval(entryTime, { start: periodStart, end: setHours(entryTime, 23) }) || isWithinInterval(entryTime, { start: setHours(entryTime, 0), end: periodEnd })) {
                     matchedRatePence = parseFloat(ratePeriod.rate);
                     break;
                }
            } else {
                 if (isWithinInterval(entryTime, { start: periodStart, end: periodEnd })) {
                    matchedRatePence = parseFloat(ratePeriod.rate);
                    break;
                }
            }
        }
        totalImportCost += importKWh * (matchedRatePence / 100);
      });
      
      totalExportRevenue = totalExportKWh * (parseFloat(exportRate) / 100);
      
      const result: CalculationResult = {
        totalImportKWh,
        totalExportKWh,
        importCost: totalImportCost,
        exportRevenue: totalExportRevenue,
        netCost: totalImportCost - totalExportRevenue,
        effectiveImportRate: totalImportKWh > 0 ? (totalImportCost / totalImportKWh) * 100 : 0,
        effectiveExportRate: parseFloat(exportRate),
        period: periodLabel,
      };
      
      setCalculationResult(result);

    } catch (e: any) {
      console.error("Error fetching or calculating daily cost:", e);
      setError(e.message || "Failed to fetch or calculate cost data.");
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, inverterSerial, importRates, exportRate, toast, saveAsDefault, selectedProvider, selectedTariffName]);

  // Effect to trigger calculation when date changes
  useEffect(() => {
    if (activeTab === 'day' && dailyDate) {
        const startDate = dailyDate;
        const endDate = dailyDate;
        const label = format(dailyDate, "PPP");
        calculateCosts(startDate, endDate, label);
    } else if (activeTab === 'week' && weeklyDate) {
        const startDate = startOfWeek(weeklyDate, { weekStartsOn: 1 });
        const endDate = endOfWeek(weeklyDate, { weekStartsOn: 1 });
        const label = `Week of ${format(startDate, "MMM d, yyyy")}`;
        calculateCosts(startDate, endDate, label);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyDate, weeklyDate, activeTab, calculateCosts]);

  const renderResults = () => {
    if (!calculationResult) return null;
    const { period, totalImportKWh, totalExportKWh, effectiveImportRate, effectiveExportRate, importCost, exportRevenue, netCost } = calculationResult;
    const netCostDisplay = netCost >= 0 ? `£${netCost.toFixed(2)}` : `-£${Math.abs(netCost).toFixed(2)}`;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Calculation Results</CardTitle>
          <CardDescription>Breakdown for {period}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow><TableCell>Total Import</TableCell><TableCell className="text-right">{totalImportKWh.toFixed(2)} kWh</TableCell></TableRow>
              <TableRow><TableCell>Total Export</TableCell><TableCell className="text-right">{totalExportKWh.toFixed(2)} kWh</TableCell></TableRow>
              <TableRow><TableCell>Calculated Matched Import Rate</TableCell><TableCell className="text-right">{effectiveImportRate ? effectiveImportRate.toFixed(2) : 'N/A'} p/kWh</TableCell></TableRow>
              <TableRow><TableCell>Effective Export Rate</TableCell><TableCell className="text-right">{effectiveExportRate.toFixed(2)} p/kWh</TableCell></TableRow>
              <TableRow><TableCell>Import Cost</TableCell><TableCell className="text-right">£{importCost.toFixed(2)}</TableCell></TableRow>
              <TableRow><TableCell>Export Revenue</TableCell><TableCell className="text-right">£{exportRevenue.toFixed(2)}</TableCell></TableRow>
              <TableRow className="bg-muted/50 font-bold"><TableCell>Net Cost / Revenue</TableCell><TableCell className="text-right">{netCostDisplay}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderCalculationUI = (
    periodType: 'day' | 'week'
  ) => {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{periodType.charAt(0).toUpperCase() + periodType.slice(1)} Cost Calculation</CardTitle>
          <CardDescription>Select a {periodType} to see the energy costs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {periodType === 'day' && <Label>Select Date</Label>}
            {periodType === 'week' && <Label>Select any day in the week</Label>}
            
            {(periodType === 'day' || periodType === 'week') && (
              <Popover open={periodType === 'day' ? isDailyCalendarOpen : isWeeklyCalendarOpen} onOpenChange={periodType === 'day' ? setIsDailyCalendarOpen : setIsWeeklyCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{formatDateForDisplay(periodType === 'day' ? dailyDate : weeklyDate)}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={periodType === 'day' ? dailyDate : weeklyDate} onSelect={date => { (periodType === 'day' ? setDailyDate : setWeeklyDate)(date); (periodType === 'day' ? setIsDailyCalendarOpen : setIsWeeklyCalendarOpen)(false); }} initialFocus />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full space-y-6 py-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl flex items-center">
          <Plug className="mr-3 h-8 w-8 text-primary" />
          Tariff Cost Calculator
        </h1>
        <Button asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Link>
        </Button>
      </div>

      <Tabs defaultValue="day" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="day">Daily</TabsTrigger>
          <TabsTrigger value="week">Weekly</TabsTrigger>
          <TabsTrigger value="setup">Tariff Setup</TabsTrigger>
        </TabsList>
        
        <TabsContent value="day" className="space-y-6 mt-4">{renderCalculationUI('day')}</TabsContent>
        <TabsContent value="week" className="space-y-6 mt-4">{renderCalculationUI('week')}</TabsContent>

        <TabsContent value="setup" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Calculation Setup</CardTitle>
              <CardDescription>
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild><Info className="inline-block h-4 w-4 mr-2 text-muted-foreground hover:text-foreground cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-sm">This tool fetches your half-hourly energy import/export data and applies your specified tariff rates to calculate your costs. All rates should be in pence per kWh (e.g., 28.5).</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                 Load a preset or enter your tariff details manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 pt-4 border-t">
                <Label>Load a Tariff Preset</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select onValueChange={handleProviderChange} value={selectedProvider}>
                    <SelectTrigger><SelectValue placeholder="Select Provider" /></SelectTrigger>
                    <SelectContent>{availableProviders.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select onValueChange={handleTariffChange} value={selectedTariffName} disabled={!selectedProvider}>
                    <SelectTrigger><SelectValue placeholder="Select Tariff" /></SelectTrigger>
                    <SelectContent>{availableTariffs.map(t => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="save-as-default" checked={saveAsDefault} onCheckedChange={(c) => setSaveAsDefault(Boolean(c))} />
                  <Label htmlFor="save-as-default" className="font-normal">Save as default tariff for this page</Label>
                </div>
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <Label>Import Tariff (p/kWh)</Label>
                {importRates.map((rate) => (
                  <div key={rate.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center p-2 border rounded-md">
                    <div className="space-y-1"><Label htmlFor={`start-${rate.id}`} className="text-xs">Start</Label><Input id={`start-${rate.id}`} type="time" value={rate.startTime} onChange={(e) => handleImportRateChange(rate.id, 'startTime', e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor={`end-${rate.id}`} className="text-xs">End</Label><Input id={`end-${rate.id}`} type="time" value={rate.endTime} onChange={(e) => handleImportRateChange(rate.id, 'endTime', e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor={`rate-${rate.id}`} className="text-xs">Rate (p)</Label><Input id={`rate-${rate.id}`} type="number" placeholder="e.g. 28.5" value={rate.rate} onChange={(e) => handleImportRateChange(rate.id, 'rate', e.target.value)} /></div>
                    <Button variant="ghost" size="icon" className="self-end" onClick={() => removeImportRate(rate.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addImportRate}><PlusCircle className="mr-2 h-4 w-4" /> Add Rate Period</Button>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="export-rate">Export Tariff (p/kWh)</Label>
                <Input id="export-rate" type="number" placeholder="e.g., 15.0" value={exportRate} onChange={(e) => setExportRate(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 space-y-6">
          {(!apiKey || !inverterSerial) && !isLoadingApiKey && (
             <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>API Key or Inverter Not Found</AlertTitle><AlertDescription>Please set your GivEnergy API key and ensure your inverter is detected in the main application settings.</AlertDescription></Alert>
          )}
          {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
          {isLoading && (
             <Card className="flex items-center justify-center min-h-[200px]"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="mt-2 text-muted-foreground">Fetching data and calculating costs...</p></div></Card>
          )}
          {!isLoading && calculationResult && renderResults()}
          {!isLoading && !calculationResult && !error && (
             <Card className="flex items-center justify-center min-h-[200px]"><p className="text-muted-foreground">Select a date to see results.</p></Card>
          )}
      </div>
    </div>
  );
}
