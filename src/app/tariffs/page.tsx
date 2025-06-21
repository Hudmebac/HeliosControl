
"use client";

import * as React from 'react';
import Link from "next/link";
import { useState, useCallback, useMemo, useEffect } from "react"; // Added useMemo, useEffect
import { v4 as uuidv4 } from 'uuid';
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { getEnergyFlows } from "@/lib/givenergy";
import type { EnergyFlowRawEntry } from '@/lib/types';
import { format, parse, setHours, setMinutes, setSeconds, isWithinInterval, addDays } from 'date-fns';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"; // Removed CardFooter
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plug, CalendarIcon, Loader2, PlusCircle, Trash2, Info, AlertTriangle, AlertCircle } from "lucide-react";
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

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [importRates, setImportRates] = useState<TariffRate[]>([
    { id: uuidv4(), startTime: '00:00', endTime: '23:59', rate: '28.0' },
  ]);
  const [exportRate, setExportRate] = useState<string>('15.0');
  
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  // State for presets and selected tariff
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedTariffName, setSelectedTariffName] = useState<string>("");

  const availableProviders = useMemo(() => [...new Set(TARIFF_PRESETS.map(t => t.provider))], []);
  const availableTariffs = useMemo(() => TARIFF_PRESETS.filter(t => t.provider === selectedProvider), [selectedProvider]);

  const DEFAULT_TARIFF_STORAGE_KEY = "defaultTariff";

  // Load default tariff from local storage on mount
  useEffect(() => {
    const storedTariff = localStorage.getItem(DEFAULT_TARIFF_STORAGE_KEY);
    if (storedTariff) {
      const defaultTariff = JSON.parse(storedTariff);
      const tariff = TARIFF_PRESETS.find(t => t.provider === defaultTariff?.provider && t.name === defaultTariff?.name);
      if (tariff) {
        setSelectedProvider(defaultTariff!.provider);
        setSelectedTariffName(defaultTariff!.name);
        const newRates = tariff.rates.map(r => ({
          id: uuidv4(),
          startTime: r.start,
          endTime: r.end,
          rate: String(r.rate),
        }));
        setImportRates(newRates);
      }
     }
  }, []); // Empty dependency array means this effect runs only once on mount

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedTariffName(""); // Reset tariff when provider changes
    setImportRates([{ id: uuidv4(), startTime: '00:00', endTime: '23:59', rate: '28.0' }]);
  };

  const handleTariffChange = (tariffName: string) => {
    setSelectedTariffName(tariffName);
    const tariff = TARIFF_PRESETS.find(t => t.provider === selectedProvider && t.name === tariffName);
    if (tariff) {
        const newRates = tariff.rates.map(r => ({
            id: uuidv4(),
            startTime: r.start,
            endTime: r.end,
            rate: String(r.rate),
            label: r.label,
        }));
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
      toast({
        variant: "destructive",
        title: "Cannot Remove",
        description: "You must have at least one import rate period.",
      });
    }
  };

  const handleCalculateCosts = useCallback(async () => {
    if (!apiKey || !inverterSerial) {
      setError("API key or inverter serial not set. Please check settings.");
      return;
    }
    if (!selectedDate) {
      setError("Please select a date to calculate costs for.");
      return;
    }
    if (importRates.some(r => !r.rate || isNaN(parseFloat(r.rate))) || !exportRate || isNaN(parseFloat(exportRate))) {
      setError("Please ensure all tariff rates are valid numbers.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setCalculationResult(null);

    // Save default tariff if checkbox is checked
    if (saveAsDefault && selectedProvider && selectedTariffName) {
      localStorage.setItem(DEFAULT_TARIFF_STORAGE_KEY, JSON.stringify({ provider: selectedProvider, name: selectedTariffName }));
    }

    try {
      const apiStartDate = format(selectedDate, "yyyy-MM-dd");
      const apiEndDate = format(addDays(selectedDate, 1), "yyyy-MM-dd");

      const flowData = await getEnergyFlows(
        apiKey,
        inverterSerial,
        apiStartDate,
        apiEndDate,
        0,
        ['2', '3', '4', '6']
      );

      if (flowData.length === 0) {
        toast({ title: "No Data", description: "No energy flow data was found for the selected date." });
        setIsLoading(false);
        return;
      }
      
      let totalImportKWh = 0;
      let totalExportKWh = 0;
      let totalImportCost = 0;

      flowData.forEach(entry => {
        const entryTime = parse(entry.start_time, 'yyyy-MM-dd HH:mm', new Date());

        const importKWh = (entry.data['3'] || 0) + (entry.data['4'] || 0);
        const exportKWh = (entry.data['2'] || 0) + (entry.data['6'] || 0);
        totalImportKWh += importKWh;
        totalExportKWh += exportKWh;
        
        let matchedRatePence = 0;
        for (const ratePeriod of importRates) {
            const [startH, startM] = ratePeriod.startTime.split(':').map(Number);
            const [endH, endM] = ratePeriod.endTime.split(':').map(Number);

            const periodStart = setSeconds(setMinutes(setHours(entryTime, startH), startM), 0);
            let periodEnd = setSeconds(setMinutes(setHours(entryTime, endH), endM), 59);

            if (periodEnd < periodStart) {
                const endOfDay = setSeconds(setMinutes(setHours(entryTime, 23), 59), 59);
                const startOfDay = setSeconds(setMinutes(setHours(entryTime, 0), 0), 0);
                if (isWithinInterval(entryTime, { start: periodStart, end: endOfDay }) || 
                    isWithinInterval(entryTime, { start: startOfDay, end: periodEnd })) {
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

      const totalExportRevenue = totalExportKWh * (parseFloat(exportRate) / 100);

      setCalculationResult({
        totalImportKWh,
        totalExportKWh,
        importCost: totalImportCost,
        exportRevenue: totalExportRevenue,
        netCost: totalImportCost - totalExportRevenue,
        effectiveImportRate: totalImportKWh > 0 ? (totalImportCost / totalImportKWh) * 100 : 0,
        effectiveExportRate: parseFloat(exportRate),
      });

    } catch (e: any) {
      setError(e.message || "Failed to fetch or calculate cost data.");
      toast({ variant: "destructive", title: "Calculation Error", description: e.message });
    } finally {
      setIsLoading(false);      
    }
  }, [apiKey, inverterSerial, selectedDate, importRates, exportRate, toast, saveAsDefault, selectedProvider, selectedTariffName]);

  // Recalculate when the selected date changes
  useEffect(() => {
    handleCalculateCosts();
  }, [selectedDate, handleCalculateCosts]); // Added handleCalculateCosts to dependencies


  const renderResults = () => {
    if (!calculationResult) return null;

    const resultsData = [
      { metric: "Total Import", value: `${calculationResult.totalImportKWh.toFixed(2)} kWh` },
      { metric: "Total Export", value: `${calculationResult.totalExportKWh.toFixed(2)} kWh` },
      { metric: "Effective Import Rate", value: `${calculationResult.effectiveImportRate.toFixed(2)} p/kWh` },
      { metric: "Effective Export Rate", value: `${calculationResult.effectiveExportRate.toFixed(2)} p/kWh` },
      { metric: "Import Cost", value: `£${calculationResult.importCost.toFixed(2)}` },
      { metric: "Export Revenue", value: `£${calculationResult.exportRevenue.toFixed(2)}` },
    ];
    const netCost = calculationResult.netCost;
    const netCostDisplay = netCost >= 0 ? `£${netCost.toFixed(2)}` : `-£${Math.abs(netCost).toFixed(2)}`;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Calculation Results</CardTitle>
          <CardDescription>Breakdown for {format(selectedDate!, "PPP")}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {resultsData.map(item => (
                <TableRow key={item.metric}>
                  <TableCell className="font-medium">{item.metric}</TableCell>
                  <TableCell className="text-right">{item.value}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Net Cost / Revenue</TableCell>
                <TableCell className="text-right">{netCostDisplay}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
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

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How it Works</AlertTitle>
        <AlertDescription>
          This tool fetches your half-hourly energy import and export data for a selected day. It then applies your specified tariff rates to calculate your daily cost. All rates should be entered in pence per kWh (e.g., 28.5).
        </AlertDescription>
      </Alert>

      {(!apiKey || !inverterSerial) && !isLoadingApiKey && (
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>API Key or Inverter Not Found</AlertTitle>
            <AlertDescription>Please set your GivEnergy API key and ensure your inverter is detected in the main application settings to use this feature.</AlertDescription>
         </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calculation Setup</CardTitle>
            <CardDescription>Select a date, Use Default or load a preset or enter your tariff details manually.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="calc-date">Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="calc-date" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateForDisplay(selectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus /></PopoverContent>
              </Popover>
            </div>

            {/* <div className="space-y-4 pt-4 border-t">
              <Label>Load Tariff Preset</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select onValueChange={handleProviderChange} value={selectedProvider}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableProviders.map(provider => (
                            <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select onValueChange={handleTariffChange} value={selectedTariffName} disabled={!selectedProvider}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Tariff" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableTariffs.map(tariff => (
                            <SelectItem key={tariff.name} value={tariff.name}>{tariff.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div> */}

            <div className="space-y-4 pt-4 border-t">
              <Label>Your Tariff</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select onValueChange={handleProviderChange} value={selectedProvider}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableProviders.map(provider => (
                            <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select onValueChange={handleTariffChange} value={selectedTariffName} disabled={!selectedProvider}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Tariff" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableTariffs.map(tariff => (
                            <SelectItem key={tariff.name} value={tariff.name}>{tariff.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="save-as-default"
                  checked={saveAsDefault}
                  onCheckedChange={(checked) => setSaveAsDefault(Boolean(checked))}
                />
                <label
                  htmlFor="save-as-default"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Save as default tariff for this page
                </label>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label>Import Tariff (p/kWh)</Label>
              </div>
              {importRates.map((rate, index) => (
                <div key={rate.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center p-2 border rounded-md">
                    <div className="space-y-1">
                        <Label htmlFor={`start-time-${rate.id}`} className="text-xs">Start</Label>
                        <Input id={`start-time-${rate.id}`} type="time" value={rate.startTime} onChange={(e) => handleImportRateChange(rate.id, 'startTime', e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor={`end-time-${rate.id}`} className="text-xs">End</Label>
                        <Input id={`end-time-${rate.id}`} type="time" value={rate.endTime} onChange={(e) => handleImportRateChange(rate.id, 'endTime', e.target.value)} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor={`rate-${rate.id}`} className="text-xs">Rate (p)</Label>
                        <Input id={`rate-${rate.id}`} type="number" placeholder="e.g. 28.5" value={rate.rate} onChange={(e) => handleImportRateChange(rate.id, 'rate', e.target.value)} />
                    </div>
                    <Button variant="ghost" size="icon" className="self-end" onClick={() => removeImportRate(rate.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addImportRate}><PlusCircle className="mr-2 h-4 w-4" /> Add Rate Period</Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="export-rate">Export Tariff (p/kWh)</Label>
              <Input id="export-rate" type="number" placeholder="e.g., 15.0" value={exportRate} onChange={(e) => setExportRate(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleCalculateCosts} disabled={isLoading || !apiKey || !inverterSerial} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Calculate Daily Cost
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {isLoading && (
                 <Card className="flex items-center justify-center min-h-[200px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="mt-2 text-muted-foreground">Fetching data and calculating costs...</p>
                    </div>
                 </Card>
            )}
            {!isLoading && calculationResult && renderResults()}
            {!isLoading && !calculationResult && !error && (
                <Card className="flex items-center justify-center min-h-[200px]">
                    <p className="text-muted-foreground">Results will be displayed here.</p>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
