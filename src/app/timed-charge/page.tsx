
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useApiKey } from "@/hooks/use-api-key";
import { useToast } from "@/hooks/use-toast";
import { _fetchGivEnergyAPI } from "@/lib/givenergy";
import type { NamedPreset, PresetSettings, InverterPresetId, RawPresetResponse, PresetSlot } from '@/lib/types';
import { useLocalStorageBatterySchedules } from '@/hooks/use-local-storage-battery-schedules';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, ArrowLeft, BatteryCharging, Save, PlusCircle, Edit, Trash2, DownloadCloud, CheckCircle2, RefreshCw, X, Info } from "lucide-react";
import { Badge } from '@/components/ui/badge';


const PRESET_CONFIG: Record<InverterPresetId, { title: string, description: string, slotAction: string }> = {
    'timed-charge': {
        title: "Timed Charge",
        description: "Charge the battery from the grid during specified times. Ideal for off-peak tariffs.",
        slotAction: "Charge to"
    },
    'timed-export': {
        title: "Timed Export",
        description: "Force discharge the battery to the grid at its maximum power. Ideal for peak export tariffs.",
        slotAction: "Discharge to"
    },
    'timed-discharge': {
        title: "Timed Discharge",
        description: "Discharge the battery to meet home demand during specified times.",
        slotAction: "Discharge to"
    }
};

const DEFAULT_PRESET_SETTINGS: PresetSettings = { enabled: false, slots: [] };

// --- Dialog for Add/Edit ---
interface PresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name:string } & Omit<NamedPreset, 'id' | 'createdAt' | 'updatedAt'>) => void;
  existingPreset?: Partial<NamedPreset>;
  activePresetId: InverterPresetId;
}

function PresetDialog({ isOpen, onClose, onSave, existingPreset, activePresetId }: PresetDialogProps) {
    const [name, setName] = useState('');
    const [settings, setSettings] = useState<PresetSettings>(DEFAULT_PRESET_SETTINGS);

    useEffect(() => {
        if (isOpen) {
            setName(existingPreset?.name || `New ${PRESET_CONFIG[activePresetId].title} Schedule`);
            // Ensure slots is always an array, providing a default empty slot if none exist
            const initialSlots = existingPreset?.settings?.slots;
            const slots = (initialSlots && initialSlots.length > 0) ? initialSlots : [{ start_time: '00:00', end_time: '04:00', percent_limit: 100 }];
            setSettings(existingPreset?.settings || { enabled: false, slots });
        }
    }, [isOpen, existingPreset, activePresetId]);

    const handleSlotChange = (index: number, field: keyof PresetSlot, value: any) => {
        const newSlots = [...settings.slots];
        newSlots[index] = { ...newSlots[index], [field]: value };
        setSettings(prev => ({ ...prev, slots: newSlots }));
    };

    const addSlot = () => {
        setSettings(prev => ({ ...prev, slots: [...prev.slots, { start_time: '00:00', end_time: '00:00', percent_limit: 100 }]}));
    }

    const removeSlot = (index: number) => {
        setSettings(prev => ({ ...prev, slots: prev.slots.filter((_, i) => i !== index) }));
    }

    const handleSubmit = () => {
        if (!name.trim()) {
            // Basic validation
            alert("Please provide a name for the preset.");
            return;
        }
        onSave({
            name,
            presetId: activePresetId,
            settings
        });
        onClose();
    };

    if (!isOpen) return null;

    const config = PRESET_CONFIG[activePresetId];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{existingPreset?.id ? 'Edit Preset' : `New ${config.title} Preset`}</DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                    <div><Label>Preset Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                    <div className="flex items-center justify-between p-3 border rounded-md">
                        <Label>Enable this mode on the inverter</Label>
                        <Switch checked={settings.enabled} onCheckedChange={checked => setSettings(prev => ({...prev, enabled: checked}))} />
                    </div>
                    
                    {settings.slots.map((slot, index) => (
                        <div key={index} className="space-y-4 p-3 border rounded-md bg-background relative">
                            {settings.slots.length > 1 && (
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeSlot(index)}><X className="h-4 w-4"/></Button>
                            )}
                            <h5 className="font-medium">Slot {index + 1}</h5>
                             <div className="grid grid-cols-2 gap-3">
                                <div><Label>Start Time</Label><Input type="time" value={slot.start_time} onChange={e => handleSlotChange(index, 'start_time', e.target.value)} /></div>
                                <div><Label>End Time</Label><Input type="time" value={slot.end_time} onChange={e => handleSlotChange(index, 'end_time', e.target.value)} /></div>
                             </div>
                             <div>
                                <div className="flex justify-between mb-1"><Label>{config.slotAction}</Label><span>{slot.percent_limit}%</span></div>
                                <Slider min={4} max={100} step={1} value={[slot.percent_limit]} onValueChange={val => handleSlotChange(index, 'percent_limit', val[0])} />
                             </div>
                        </div>
                    ))}
                     <Button variant="outline" size="sm" onClick={addSlot}><PlusCircle className="mr-2 h-4 w-4" /> Add Slot</Button>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit}>Save Preset</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Page Component ---
export default function InverterPresetsPage() {
  const { apiKey, inverterSerial, isLoading: isApiKeyLoading } = useApiKey();
  const { toast } = useToast();

  const { presets, addPreset, updatePreset, deletePreset, isLoading: isLoadingPresets } = useLocalStorageBatterySchedules(inverterSerial);
  
  const [activeTab, setActiveTab] = useState<InverterPresetId>('timed-charge');
  const [currentDeviceValues, setCurrentDeviceValues] = useState<Record<InverterPresetId, PresetSettings | null>>({
      'timed-charge': null, 'timed-discharge': null, 'timed-export': null
  });
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  
  const [isLoadingDeviceState, setIsLoadingDeviceState] = useState(true);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [presetToEdit, setPresetToEdit] = useState<Partial<NamedPreset> | undefined>(undefined);
  
  const [presetToDelete, setPresetToDelete] = useState<NamedPreset | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const fetchCurrentDevicePreset = useCallback(async (presetId: InverterPresetId) => {
    if (!apiKey || !inverterSerial) return null;
    setIsLoadingDeviceState(true);
    try {
        const response = await _fetchGivEnergyAPI<RawPresetResponse>(apiKey, `/inverter/${inverterSerial}/presets/${presetId}`);
        const settings = response.data.value;
        setCurrentDeviceValues(prev => ({ ...prev, [presetId]: settings }));
        return settings;
    } catch (error) {
        console.error(`Failed to fetch current device preset for ${presetId}:`, error);
        toast({ variant: "destructive", title: "Fetch Error", description: `Could not load ${PRESET_CONFIG[presetId].title} settings from inverter.` });
        setCurrentDeviceValues(prev => ({ ...prev, [presetId]: null }));
        return null;
    } finally {
        setIsLoadingDeviceState(false);
    }
  }, [apiKey, inverterSerial, toast]);
  
  const areSettingsEqual = (s1?: PresetSettings | null, s2?: PresetSettings | null): boolean => {
      if (!s1 || !s2) return false;
      const normalize = (s: PresetSettings) => ({
          enabled: !!s.enabled,
          slots: (s.slots || []).map(slot => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
              percent_limit: Number(slot.percent_limit)
          })).sort((a, b) => a.start_time.localeCompare(b.start_time)) // Sort slots for consistent comparison
      });
      return JSON.stringify(normalize(s1)) === JSON.stringify(normalize(s2));
  };

  useEffect(() => {
    if (!isApiKeyLoading && apiKey && inverterSerial) {
        fetchCurrentDevicePreset(activeTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiKeyLoading, apiKey, inverterSerial, activeTab]); // Re-fetch when tab changes

  useEffect(() => {
    const deviceSettings = currentDeviceValues[activeTab];
    if (deviceSettings && presets.length > 0) {
        const found = presets.find(p => p.presetId === activeTab && areSettingsEqual(p.settings, deviceSettings));
        setActivePresetId(found?.id || null);
    } else {
        setActivePresetId(null);
    }
  }, [currentDeviceValues, presets, activeTab]);

  const handleActivatePreset = async (preset: NamedPreset) => {
    if (!apiKey || !inverterSerial) return;
    setIsActivating(preset.id);
    try {
        await _fetchGivEnergyAPI(apiKey, `/inverter/${inverterSerial}/presets/${preset.presetId}`, {
            method: 'POST',
            body: JSON.stringify(preset.settings),
        });
        toast({ title: "Preset Activated", description: `"${preset.name}" is now active on the inverter.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Activation Error", description: "An unexpected error occurred." });
    } finally {
        await fetchCurrentDevicePreset(preset.presetId);
        setIsActivating(null);
    }
  };
  
  const handleRetrieveFromDevice = async () => {
    const settings = await fetchCurrentDevicePreset(activeTab);
    if (settings) {
        const config = PRESET_CONFIG[activeTab];
        setPresetToEdit({ name: `${config.title} - ${new Date().toLocaleDateString()}`, presetId: activeTab, settings });
        setIsDialogOpen(true);
    }
  };
  
  const handleSavePreset = (data: { name: string } & Omit<NamedPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (presetToEdit?.id) {
        updatePreset(presetToEdit.id, { name: data.name, settings: data.settings });
        toast({ title: "Preset Updated", description: `"${data.name}" has been saved.` });
    } else {
        addPreset(data);
        toast({ title: "Preset Added", description: `"${data.name}" has been added to your list.` });
    }
    setPresetToEdit(undefined);
  };
  
  const openEditDialog = (preset: NamedPreset) => {
    setPresetToEdit(preset);
    setIsDialogOpen(true);
  };
  
  const openDeleteDialog = (preset: NamedPreset) => {
    setPresetToDelete(preset);
    setIsDeleteAlertOpen(true);
  };
  
  const confirmDeletePreset = () => {
      if(presetToDelete) {
          deletePreset(presetToDelete.id);
          toast({ title: "Preset Deleted", description: `"${presetToDelete.name}" removed from your local list.` });
      }
      setIsDeleteAlertOpen(false);
      setPresetToDelete(null);
  };

  const formatPresetSummary = (settings: PresetSettings): string => {
    if (!settings.enabled) return "Mode is disabled.";
    if (!settings.slots || settings.slots.length === 0) return "Mode is enabled but has no time slots defined.";
    
    return settings.slots.map(slot => 
        `${slot.start_time}-${slot.end_time} to ${slot.percent_limit}%`
    ).join(' | ');
  };

  const renderPresetList = (presetId: InverterPresetId) => {
    const filteredPresets = presets.filter(p => p.presetId === presetId);
    const isLoadingPage = isApiKeyLoading || isLoadingDeviceState || isLoadingPresets;
    const config = PRESET_CONFIG[presetId];

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>{config.title} Presets</CardTitle>
                    <div className="flex items-center space-x-2">
                        <Button onClick={handleRetrieveFromDevice} variant="outline" size="sm" disabled={isLoadingDeviceState}><DownloadCloud className="mr-2 h-4 w-4" /> Retrieve from Device</Button>
                        <Button onClick={() => { setPresetToEdit(undefined); setIsDialogOpen(true); }} size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New</Button>
                    </div>
                </div>
                <CardDescription>
                    {config.description} Presets are saved in your browser. "Active on Device" means the inverter's current settings match a saved preset.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingPage ? (
                     <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> Loading...</div>
                ) : filteredPresets.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No saved presets for {config.title}. Click "Add New" or "Retrieve from Device" to get started.</p>
                ) : (
                    <div className="space-y-3">
                        {filteredPresets.map(preset => {
                            const isActive = preset.id === activePresetId;
                            const isThisActivating = isActivating === preset.id;
                            return (
                                <Card key={preset.id} className={isActive ? 'border-primary' : ''}>
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg flex items-center">{preset.name} {isActive && <Badge variant="default" className="ml-2 bg-green-500">Active</Badge>}</CardTitle>
                                                <CardDescription className="text-xs">Last updated: {new Date(preset.updatedAt).toLocaleString()}</CardDescription>
                                            </div>
                                            <div className="flex items-center space-x-1.5">
                                                <Button size="sm" onClick={() => handleActivatePreset(preset)} disabled={isActive || !!isActivating}>
                                                    {isThisActivating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : isActive ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/> : null}
                                                    {isThisActivating ? 'Activating' : isActive ? 'Activated' : 'Activate'}
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={() => openEditDialog(preset)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="destructive" size="icon" onClick={() => openDeleteDialog(preset)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent><p className="text-sm text-muted-foreground">{formatPresetSummary(preset.settings)}</p></CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <Button onClick={() => fetchCurrentDevicePreset(presetId)} variant="outline" size="sm" disabled={isLoadingDeviceState}>
                    <RefreshCw className="mr-2 h-4 w-4"/> Refresh Device Status
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Inverter Preset Manager</h1>
          <Button variant="outline" asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link></Button>
        </div>

        <Alert>
            <Info className="h-4 w-4"/>
            <AlertTitle>New Preset System</AlertTitle>
            <AlertDescription>
                This page now uses the official GivEnergy Presets API. Your old schedules based on individual settings are no longer used. Please recreate your desired schedules using this new system.
            </AlertDescription>
        </Alert>

        {!apiKey || !inverterSerial ? (
            <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Configuration Error</AlertTitle><AlertDescription>API Key or Inverter Serial not found. Please check settings.</AlertDescription></Alert>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InverterPresetId)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="timed-charge">Timed Charge</TabsTrigger>
                <TabsTrigger value="timed-export">Timed Export</TabsTrigger>
            </TabsList>
            <TabsContent value="timed-charge" className="mt-4">
                {renderPresetList('timed-charge')}
            </TabsContent>
            <TabsContent value="timed-export" className="mt-4">
                {renderPresetList('timed-export')}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <PresetDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSavePreset}
        existingPreset={presetToEdit}
        activePresetId={activeTab}
      />
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete Preset?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{presetToDelete?.name}" from your local list. It will not change the settings on your inverter.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmDeletePreset}>Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
