
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { _fetchGivEnergyAPI } from "@/lib/givenergy";
import type { NamedBatterySchedule, BatteryScheduleSettings } from '@/lib/types';
import { useLocalStorageBatterySchedules } from '@/hooks/use-local-storage-battery-schedules';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle, ArrowLeft, BatteryCharging, Save, PlusCircle, Edit, Trash2, DownloadCloud, CheckCircle2, RefreshCw } from "lucide-react";
import { Badge } from '@/components/ui/badge';

const SETTING_IDS = {
  ENABLE_AC_CHARGE: '53',
  CHARGE_SLOT_1_START: '54',
  CHARGE_SLOT_1_END: '55',
  CHARGE_TARGET_SOC: '56',
  CHARGE_SLOT_2_START: '60',
  CHARGE_SLOT_2_END: '61',
  CHARGE_TARGET_SOC_2: '62',
  DISCHARGE_SLOT_1_START: '57',
  DISCHARGE_SLOT_1_END: '58',
  DISCHARGE_TARGET_SOC: '59',
  DISCHARGE_SLOT_2_START: '63',
  DISCHARGE_SLOT_2_END: '64',
  DISCHARGE_TARGET_SOC_2: '65',
};

const DEFAULT_SETTINGS: BatteryScheduleSettings = {
  enableAcCharge: false,
  chargeSlot1: { start: "00:00", end: "00:00", soc: 100 },
  chargeSlot2: { start: "00:00", end: "00:00", soc: 100 },
  dischargeSlot1: { start: "00:00", end: "00:00", soc: 4 },
  dischargeSlot2: { start: "00:00", end: "00:00", soc: 4 },
};

// --- Dialog Component for Add/Edit ---
interface BatteryScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string, settings: BatteryScheduleSettings }) => void;
  existingSchedule?: Partial<NamedBatterySchedule>;
}

function BatteryScheduleDialog({ isOpen, onClose, onSave, existingSchedule }: BatteryScheduleDialogProps) {
    const [name, setName] = useState('');
    const [settings, setSettings] = useState<BatteryScheduleSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        if (isOpen) {
            setName(existingSchedule?.name || 'New Schedule');
            setSettings(existingSchedule?.settings || DEFAULT_SETTINGS);
        }
    }, [isOpen, existingSchedule]);

    const handleSettingChange = (key: keyof BatteryScheduleSettings, value: any) => {
        setSettings(prev => ({...prev, [key]: value}));
    };
    
    const handleSlotChange = (slot: 'chargeSlot1' | 'chargeSlot2' | 'dischargeSlot1' | 'dischargeSlot2', field: 'start' | 'end' | 'soc', value: any) => {
        setSettings(prev => ({
            ...prev,
            [slot]: { ...prev[slot], [field]: value }
        }));
    };
    
    const handleSubmit = () => {
        onSave({ name, settings });
        onClose();
    };

    if (!isOpen) return null;

    const renderSlot = (type: 'charge' | 'discharge', slotNum: 1 | 2) => {
        const slotKey = `${type}Slot${slotNum}` as const;
        const slotData = settings[slotKey];
        const isCharge = type === 'charge';
        return (
             <div className="space-y-4 p-3 border rounded-md bg-background">
                <h5 className="font-medium">{isCharge ? `Charge Slot ${slotNum}`: `Discharge Slot ${slotNum}`}</h5>
                 <div className="grid grid-cols-2 gap-3">
                    <div><Label>Start</Label><Input type="time" value={slotData.start} onChange={e => handleSlotChange(slotKey, 'start', e.target.value)} /></div>
                    <div><Label>End</Label><Input type="time" value={slotData.end} onChange={e => handleSlotChange(slotKey, 'end', e.target.value)} /></div>
                 </div>
                 <div>
                    <div className="flex justify-between mb-1"><Label>{isCharge ? 'Charge to' : 'Discharge to'}</Label><span>{slotData.soc}%</span></div>
                    <Slider min={4} max={100} step={1} value={[slotData.soc]} onValueChange={val => handleSlotChange(slotKey, 'soc', val[0])} />
                 </div>
             </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{existingSchedule?.id ? 'Edit Schedule' : 'New Schedule'}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div><Label>Schedule Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                    <div className="flex items-center justify-between p-3 border rounded-md">
                        <Label>Enable Timed Charging</Label>
                        <Switch checked={settings.enableAcCharge} onCheckedChange={checked => handleSettingChange('enableAcCharge', checked)} />
                    </div>
                    <h4 className="font-semibold text-lg pt-2">Charge Times</h4>
                    {renderSlot('charge', 1)}
                    {renderSlot('charge', 2)}
                    <h4 className="font-semibold text-lg pt-2">Discharge Times</h4>
                    {renderSlot('discharge', 1)}
                    {renderSlot('discharge', 2)}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Schedule</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Page Component ---
export default function BatterySchedulingPage() {
  const { apiKey, inverterSerial, isLoading: isApiKeyLoading } = useApiKey();
  const { toast } = useToast();

  const { schedules, addSchedule, updateSchedule, deleteSchedule, isLoading: isLoadingSchedules } = useLocalStorageBatterySchedules(inverterSerial);

  const [currentDeviceSettings, setCurrentDeviceSettings] = useState<BatteryScheduleSettings | null>(null);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  const [isLoadingDeviceState, setIsLoadingDeviceState] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<Partial<NamedBatterySchedule> | undefined>(undefined);
  
  const [scheduleToDelete, setScheduleToDelete] = useState<NamedBatterySchedule | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const fetchCurrentDeviceSettings = useCallback(async () => {
    if (!apiKey || !inverterSerial) return null;
    setIsLoadingDeviceState(true);
    try {
        const settingValues: Record<string, any> = {};
        for (const id of Object.values(SETTING_IDS)) {
            const res = await _fetchGivEnergyAPI<{ data: { value: string | number } }>(apiKey, `/inverter/${inverterSerial}/settings/${id}/read`, { suppressErrorForStatus: [404] });
            settingValues[id] = res.data.value;
        }

        const deviceSettings: BatteryScheduleSettings = {
            enableAcCharge: settingValues[SETTING_IDS.ENABLE_AC_CHARGE] === 1 || settingValues[SETTING_IDS.ENABLE_AC_CHARGE] === true,
            chargeSlot1: { start: String(settingValues[SETTING_IDS.CHARGE_SLOT_1_START]), end: String(settingValues[SETTING_IDS.CHARGE_SLOT_1_END]), soc: Number(settingValues[SETTING_IDS.CHARGE_TARGET_SOC]) },
            chargeSlot2: { start: String(settingValues[SETTING_IDS.CHARGE_SLOT_2_START]), end: String(settingValues[SETTING_IDS.CHARGE_SLOT_2_END]), soc: Number(settingValues[SETTING_IDS.CHARGE_TARGET_SOC_2]) },
            dischargeSlot1: { start: String(settingValues[SETTING_IDS.DISCHARGE_SLOT_1_START]), end: String(settingValues[SETTING_IDS.DISCHARGE_SLOT_1_END]), soc: Number(settingValues[SETTING_IDS.DISCHARGE_TARGET_SOC]) },
            dischargeSlot2: { start: String(settingValues[SETTING_IDS.DISCHARGE_SLOT_2_START]), end: String(settingValues[SETTING_IDS.DISCHARGE_SLOT_2_END]), soc: Number(settingValues[SETTING_IDS.DISCHARGE_TARGET_SOC_2]) },
        };
        setCurrentDeviceSettings(deviceSettings);
        return deviceSettings;
    } catch (error) {
        console.error("Failed to fetch current device settings:", error);
        toast({ variant: "destructive", title: "Fetch Error", description: "Could not load current settings from inverter." });
        return null;
    } finally {
        setIsLoadingDeviceState(false);
    }
  }, [apiKey, inverterSerial, toast]);

  const areSettingsEqual = (s1?: BatteryScheduleSettings | null, s2?: BatteryScheduleSettings | null): boolean => {
      if (!s1 || !s2) return false;
      const normalize = (s: BatteryScheduleSettings) => ({
          ...s,
          enableAcCharge: !!s.enableAcCharge,
          chargeSlot1: { ...s.chargeSlot1, soc: Number(s.chargeSlot1.soc) },
          chargeSlot2: { ...s.chargeSlot2, soc: Number(s.chargeSlot2.soc) },
          dischargeSlot1: { ...s.dischargeSlot1, soc: Number(s.dischargeSlot1.soc) },
          dischargeSlot2: { ...s.dischargeSlot2, soc: Number(s.dischargeSlot2.soc) },
      });
      return JSON.stringify(normalize(s1)) === JSON.stringify(normalize(s2));
  };

  useEffect(() => {
    if (!isApiKeyLoading && apiKey && inverterSerial) {
        fetchCurrentDeviceSettings();
    }
  }, [isApiKeyLoading, apiKey, inverterSerial, fetchCurrentDeviceSettings]);

  useEffect(() => {
    if (currentDeviceSettings && schedules.length > 0) {
        const found = schedules.find(s => areSettingsEqual(s.settings, currentDeviceSettings));
        setActiveScheduleId(found?.id || null);
    } else {
        setActiveScheduleId(null);
    }
  }, [currentDeviceSettings, schedules]);

  const handleActivateSchedule = async (schedule: NamedBatterySchedule) => {
    if (!apiKey || !inverterSerial) return;
    setIsActivating(schedule.id);
    let allSucceeded = true;
    try {
        const settingsMap: Record<string, any> = {
            [SETTING_IDS.ENABLE_AC_CHARGE]: schedule.settings.enableAcCharge ? 1 : 0,
            [SETTING_IDS.CHARGE_SLOT_1_START]: schedule.settings.chargeSlot1.start,
            [SETTING_IDS.CHARGE_SLOT_1_END]: schedule.settings.chargeSlot1.end,
            [SETTING_IDS.CHARGE_TARGET_SOC]: schedule.settings.chargeSlot1.soc,
            [SETTING_IDS.CHARGE_SLOT_2_START]: schedule.settings.chargeSlot2.start,
            [SETTING_IDS.CHARGE_SLOT_2_END]: schedule.settings.chargeSlot2.end,
            [SETTING_IDS.CHARGE_TARGET_SOC_2]: schedule.settings.chargeSlot2.soc,
            [SETTING_IDS.DISCHARGE_SLOT_1_START]: schedule.settings.dischargeSlot1.start,
            [SETTING_IDS.DISCHARGE_SLOT_1_END]: schedule.settings.dischargeSlot1.end,
            [SETTING_IDS.DISCHARGE_TARGET_SOC]: schedule.settings.dischargeSlot1.soc,
            [SETTING_IDS.DISCHARGE_SLOT_2_START]: schedule.settings.dischargeSlot2.start,
            [SETTING_IDS.DISCHARGE_SLOT_2_END]: schedule.settings.dischargeSlot2.end,
            [SETTING_IDS.DISCHARGE_TARGET_SOC_2]: schedule.settings.dischargeSlot2.soc,
        };

        for (const [id, value] of Object.entries(settingsMap)) {
            try {
                await _fetchGivEnergyAPI(apiKey, `/inverter/${inverterSerial}/settings/${id}/write`, { method: 'POST', body: JSON.stringify({ value }), suppressErrorForStatus: [404] });
            } catch(e) {
                allSucceeded = false;
                console.error(`Failed to write setting ${id}`, e);
            }
        }

        if (allSucceeded) {
            toast({ title: "Schedule Activated", description: `"${schedule.name}" is now active on the inverter.` });
        } else {
            toast({ variant: "destructive", title: "Partial Success", description: "Some settings failed to activate. Check console for details." });
        }
    } catch (error) {
        toast({ variant: "destructive", title: "Activation Error", description: "An unexpected error occurred." });
    } finally {
        await fetchCurrentDeviceSettings();
        setIsActivating(null);
    }
  };

  const handleRetrieveFromDevice = async () => {
    const settings = await fetchCurrentDeviceSettings();
    if (settings) {
        setScheduleToEdit({ name: `Retrieved - ${new Date().toLocaleString()}`, settings });
        setIsDialogOpen(true);
    }
  };

  const handleSaveSchedule = (data: { name: string, settings: BatteryScheduleSettings }) => {
    if (scheduleToEdit?.id) {
        updateSchedule(scheduleToEdit.id, data);
        toast({ title: "Schedule Updated", description: `"${data.name}" has been saved.` });
    } else {
        addSchedule(data);
        toast({ title: "Schedule Added", description: `"${data.name}" has been added to your list.` });
    }
    setScheduleToEdit(undefined);
  };
  
  const openEditDialog = (schedule: NamedBatterySchedule) => {
    setScheduleToEdit(schedule);
    setIsDialogOpen(true);
  };
  
  const openDeleteDialog = (schedule: NamedBatterySchedule) => {
    setScheduleToDelete(schedule);
    setIsDeleteAlertOpen(true);
  };
  
  const confirmDeleteSchedule = () => {
      if(scheduleToDelete) {
          deleteSchedule(scheduleToDelete.id);
          toast({ title: "Schedule Deleted", description: `"${scheduleToDelete.name}" removed from your local list.` });
      }
      setIsDeleteAlertOpen(false);
      setScheduleToDelete(null);
  };

  const formatScheduleSummary = (settings: BatteryScheduleSettings): string => {
    const parts: string[] = [];
    if (settings.enableAcCharge) {
        if(settings.chargeSlot1.start !== settings.chargeSlot1.end) parts.push(`Charge1: ${settings.chargeSlot1.start}-${settings.chargeSlot1.end} to ${settings.chargeSlot1.soc}%`);
        if(settings.chargeSlot2.start !== settings.chargeSlot2.end) parts.push(`Charge2: ${settings.chargeSlot2.start}-${settings.chargeSlot2.end} to ${settings.chargeSlot2.soc}%`);
    }
    if(settings.dischargeSlot1.start !== settings.dischargeSlot1.end) parts.push(`Discharge1: ${settings.dischargeSlot1.start}-${settings.dischargeSlot1.end} to ${settings.dischargeSlot1.soc}%`);
    if(settings.dischargeSlot2.start !== settings.dischargeSlot2.end) parts.push(`Discharge2: ${settings.dischargeSlot2.start}-${settings.dischargeSlot2.end} to ${settings.dischargeSlot2.soc}%`);
    return parts.join(' | ') || 'No active slots';
  };

  const isLoadingPage = isApiKeyLoading || isLoadingDeviceState || isLoadingSchedules;

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Battery Scheduling</h1>
          <Button variant="outline" asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link></Button>
        </div>

        {!apiKey || !inverterSerial ? (
            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Configuration Error</AlertTitle><AlertDescription>API Key or Inverter Serial not found. Please check settings.</AlertDescription></Alert>
        ) : (
          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Manage Schedules</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Button onClick={handleRetrieveFromDevice} variant="outline" size="sm" disabled={isLoadingDeviceState}><DownloadCloud className="mr-2 h-4 w-4" /> Retrieve from Device</Button>
                        <Button onClick={() => { setScheduleToEdit(undefined); setIsDialogOpen(true); }} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New</Button>
                    </div>
                </div>
                <CardDescription>
                    Create, edit, and activate battery schedules. Schedules are saved in your browser. "Active on Device" means the inverter's current settings match a saved schedule.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingPage ? (
                     <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> Loading schedules...</div>
                ) : schedules.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No saved schedules. Click "Add New" or "Retrieve from Device" to get started.</p>
                ) : (
                    <div className="space-y-3">
                        {schedules.map(schedule => {
                            const isActive = schedule.id === activeScheduleId;
                            const isThisActivating = isActivating === schedule.id;
                            return (
                                <Card key={schedule.id} className={isActive ? 'border-primary' : ''}>
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg flex items-center">{schedule.name} {isActive && <Badge variant="default" className="ml-2 bg-green-500">Active</Badge>}</CardTitle>
                                                <CardDescription className="text-xs">Last updated: {new Date(schedule.updatedAt).toLocaleString()}</CardDescription>
                                            </div>
                                            <div className="flex items-center space-x-1.5">
                                                <Button size="sm" onClick={() => handleActivateSchedule(schedule)} disabled={isActive || !!isActivating}>
                                                    {isThisActivating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : isActive ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/> : null}
                                                    {isThisActivating ? 'Activating' : isActive ? 'Activated' : 'Activate'}
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={() => openEditDialog(schedule)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="destructive" size="icon" onClick={() => openDeleteDialog(schedule)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent><p className="text-sm text-muted-foreground">{formatScheduleSummary(schedule.settings)}</p></CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={fetchCurrentDeviceSettings} variant="outline" size="sm" disabled={isLoadingDeviceState}>
                    <RefreshCw className="mr-2 h-4 w-4"/> Refresh Device Status
                </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      <BatteryScheduleDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveSchedule}
        existingSchedule={scheduleToEdit}
      />
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Schedule?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{scheduleToDelete?.name}" from your local list. It will not change the settings on your inverter.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeleteSchedule}>Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    