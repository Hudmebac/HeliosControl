
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { _fetchGivEnergyAPI } from "@/lib/givenergy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, ArrowLeft, BatteryCharging, Battery, Save } from "lucide-react";

// --- Setting IDs for GivEnergy Inverters ---
const SETTING_IDS = {
  ENABLE_AC_CHARGE: '53',
  CHARGE_TARGET_SOC: '56',
  CHARGE_SLOT_1_START: '54',
  CHARGE_SLOT_1_END: '55',
  CHARGE_SLOT_2_START: '60',
  CHARGE_SLOT_2_END: '61',
  CHARGE_TARGET_SOC_2: '62',
  // Discharge settings
  DISCHARGE_SLOT_1_START: '57',
  DISCHARGE_SLOT_1_END: '58',
  DISCHARGE_TARGET_SOC: '59',
  DISCHARGE_SLOT_2_START: '63',
  DISCHARGE_SLOT_2_END: '64',
  DISCHARGE_TARGET_SOC_2: '65',
};

type SettingsData = {
  [key: string]: string | number | boolean;
};

const initialSettings: SettingsData = {
  [SETTING_IDS.ENABLE_AC_CHARGE]: false,
  [SETTING_IDS.CHARGE_SLOT_1_START]: "00:00",
  [SETTING_IDS.CHARGE_SLOT_1_END]: "00:00",
  [SETTING_IDS.CHARGE_TARGET_SOC]: 100,
  [SETTING_IDS.CHARGE_SLOT_2_START]: "00:00",
  [SETTING_IDS.CHARGE_SLOT_2_END]: "00:00",
  [SETTING_IDS.CHARGE_TARGET_SOC_2]: 100,
  [SETTING_IDS.DISCHARGE_SLOT_1_START]: "00:00",
  [SETTING_IDS.DISCHARGE_SLOT_1_END]: "00:00",
  [SETTING_IDS.DISCHARGE_TARGET_SOC]: 4,
  [SETTING_IDS.DISCHARGE_SLOT_2_START]: "00:00",
  [SETTING_IDS.DISCHARGE_SLOT_2_END]: "00:00",
  [SETTING_IDS.DISCHARGE_TARGET_SOC_2]: 4,
};


export default function BatterySchedulingPage() {
  const { apiKey, inverterSerial, isLoading: isApiKeyLoading } = useApiKey();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SettingsData>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchSettings = useCallback(async () => {
    if (!apiKey || !inverterSerial) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    
    // Create a mutable copy of settings to update
    const newSettings: SettingsData = { ...initialSettings };
    let fetchErrorOccurred = false;

    try {
      for (const id of Object.values(SETTING_IDS)) {
        try {
          const res = await _fetchGivEnergyAPI<{ data: { value: string | number } }>(
            apiKey,
            `/inverter/${inverterSerial}/settings/${id}/read`
          );
          if (id === SETTING_IDS.ENABLE_AC_CHARGE) {
            newSettings[id] = res.data.value === 1 || res.data.value === true;
          } else {
            newSettings[id] = res.data.value;
          }
        } catch (err: any) {
          if (err instanceof Error && err.message.includes('404')) {
            console.warn(`Setting ID ${id} not found. Using default value.`);
            // The default is already in newSettings, so we just log and continue
          } else {
            console.error(`Failed to fetch setting ${id}:`, err);
            fetchErrorOccurred = true;
            // The default is already in newSettings, just flag error
          }
        }
      }
      setSettings(newSettings);
      if (fetchErrorOccurred) {
        setError("Some settings failed to load. The displayed values may not be accurate.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, inverterSerial]);

  useEffect(() => {
    if (!isApiKeyLoading) {
      fetchSettings();
    }
  }, [isApiKeyLoading, fetchSettings]);

  const handleSettingChange = (id: string, value: any) => {
    setSettings(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveSettings = async () => {
    if (!apiKey || !inverterSerial) {
      toast({ variant: "destructive", title: "Error", description: "API key or inverter serial not available." });
      return;
    }
    setIsSaving(true);
    setError(null);
    let saveErrorOccurred = false;

    try {
        for (const id of Object.keys(settings)) {
            try {
                let value = settings[id];
                if (id === SETTING_IDS.ENABLE_AC_CHARGE) {
                    value = value ? 1 : 0;
                }
                await _fetchGivEnergyAPI(apiKey, `/inverter/${inverterSerial}/settings/${id}/write`, {
                    method: 'POST',
                    body: JSON.stringify({ value }),
                });
            } catch (err: any) {
                if (err instanceof Error && err.message.includes('404')) {
                    console.warn(`Could not write to setting ID ${id} (not found). Skipping.`);
                    // Silently skip settings that don't exist on the inverter
                } else {
                    console.error(`Error saving setting ${id}:`, err);
                    saveErrorOccurred = true; // Flag that some other error occurred
                }
            }
        }

        if (saveErrorOccurred) {
            toast({ variant: "destructive", title: "Partial Success", description: "Some settings failed to save." });
        } else {
            toast({ title: "Success", description: "Battery schedule settings saved successfully." });
        }
        
        fetchSettings(); // Re-fetch to confirm settings are what we expect

    } catch (err: any) {
      // This outer catch is for setup errors before the loop.
      console.error("A critical error occurred while saving settings:", err);
      setError(err.message || 'An error occurred while saving settings.');
      toast({ variant: "destructive", title: "Save Failed", description: err.message || 'Could not save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderSlot = (type: 'charge' | 'discharge', slotNum: 1 | 2) => {
    const isCharge = type === 'charge';
    const startId = slotNum === 1 ? (isCharge ? SETTING_IDS.CHARGE_SLOT_1_START : SETTING_IDS.DISCHARGE_SLOT_1_START) : (isCharge ? SETTING_IDS.CHARGE_SLOT_2_START : SETTING_IDS.DISCHARGE_SLOT_2_START);
    const endId = slotNum === 1 ? (isCharge ? SETTING_IDS.CHARGE_SLOT_1_END : SETTING_IDS.DISCHARGE_SLOT_1_END) : (isCharge ? SETTING_IDS.CHARGE_SLOT_2_END : SETTING_IDS.DISCHARGE_SLOT_2_END);
    const socId = slotNum === 1 ? (isCharge ? SETTING_IDS.CHARGE_TARGET_SOC : SETTING_IDS.DISCHARGE_TARGET_SOC) : (isCharge ? SETTING_IDS.CHARGE_TARGET_SOC_2 : SETTING_IDS.DISCHARGE_TARGET_SOC_2);
    
    const socValue = Number(settings[socId]) || (isCharge ? 100 : 4);

    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <h4 className="font-semibold text-md">{isCharge ? `Charge Slot ${slotNum}` : `Discharge Slot ${slotNum}`}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${type}-start-${slotNum}`}>Start Time</Label>
            <Input id={`${type}-start-${slotNum}`} type="time" value={String(settings[startId] || '00:00')} onChange={(e) => handleSettingChange(startId, e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${type}-end-${slotNum}`}>End Time</Label>
            <Input id={`${type}-end-${slotNum}`} type="time" value={String(settings[endId] || '00:00')} onChange={(e) => handleSettingChange(endId, e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center">
                <Label htmlFor={`${type}-soc-${slotNum}`}>{isCharge ? 'Charge Target' : 'Discharge To'}</Label>
                <span className="text-sm font-medium text-primary">{socValue}%</span>
            </div>
            <Slider
                id={`${type}-soc-${slotNum}`}
                min={isCharge ? 4 : 4}
                max={100}
                step={1}
                value={[socValue]}
                onValueChange={(val) => handleSettingChange(socId, val[0])}
            />
        </div>
      </div>
    );
  };

  if (isApiKeyLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Battery Schedules...</p>
      </div>
    );
  }

  if (!apiKey || !inverterSerial) {
     return (
        <div className="max-w-xl mx-auto">
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Configuration Error</AlertTitle>
                <AlertDescription>
                    API Key or Inverter Serial is not available. Please configure them in the main application settings.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Battery Scheduling</h1>
        <Button variant="outline" asChild>
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timed AC Charging</CardTitle>
          <CardDescription>Set schedules to charge your battery from the grid, ideal for off-peak tariffs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <Label htmlFor="enable-ac-charge" className="text-lg font-medium flex items-center"><BatteryCharging className="mr-3 h-6 w-6 text-primary"/>Enable Timed AC Charging</Label>
            <Switch id="enable-ac-charge" checked={!!settings[SETTING_IDS.ENABLE_AC_CHARGE]} onCheckedChange={(checked) => handleSettingChange(SETTING_IDS.ENABLE_AC_CHARGE, checked)} />
          </div>
          <div className="space-y-4">
            {renderSlot('charge', 1)}
            {renderSlot('charge', 2)}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Timed Discharge</CardTitle>
          <CardDescription>Set schedules to discharge your battery to the grid, ideal for export tariffs like Octopus Flux.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderSlot('discharge', 1)}
          {renderSlot('discharge', 2)}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>An Error Occurred</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
