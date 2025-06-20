
'use client';
import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, PlugZap, CalendarDays, Power, LineChart, Settings, Loader2, Edit3, ListFilter, History, Info, Construction, FileText, Hash, Wifi, WifiOff, AlertCircle, Sun, CalendarIcon, Filter, BarChartHorizontalBig, Trash2, PlusCircle, Edit, Save, XCircle, Clock, Send, Eye, RefreshCw, DownloadCloud, Zap as ZapIcon, CheckCircle2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTheme } from '@/hooks/use-theme';
import { useApiKey } from '@/hooks/use-api-key';
import { useToast } from '@/hooks/use-toast';
import { mapEVChargerAPIStatus } from '@/lib/givenergy';
import { format, parseISO, formatISO, subDays, differenceInMinutes } from 'date-fns';
import type { EVChargerAPIRule, EVChargerDeviceScheduleListResponse, EVChargerSetSchedulePayload, EVChargerClearScheduleResponse, NamedEVChargerSchedule, RawDeviceApiScheduleEntry, RawDeviceApiPeriod } from '@/lib/types';
import { ScheduleDialog } from '@/components/ev-charger/ScheduleDialog';
import { useLocalStorageSchedules } from '@/hooks/use-local-storage-schedules';
import { Badge } from '@/components/ui/badge';


const formatDateForDisplay = (date: Date | undefined): string => {
  return date ? format(date, "PPP") : "Pick a date";
};

const ALL_DAYS_API_FORMAT = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const ALL_DAYS_DISPLAY_FORMAT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_MAP_API_TO_DISPLAY: { [key: string]: string } = Object.fromEntries(
  ALL_DAYS_DISPLAY_FORMAT.map((day, i) => [ALL_DAYS_API_FORMAT[i], day])
);

const DAY_MAP_DISPLAY_TO_API_STRING: { [key: string]: string } = Object.fromEntries(
  ALL_DAYS_DISPLAY_FORMAT.map((day, i) => [day, ALL_DAYS_API_FORMAT[i]])
);

const NUMERIC_DAY_TO_API_DAY_STRING: { [key: number]: string } = {
    0: "MONDAY", 1: "TUESDAY", 2: "WEDNESDAY", 3: "THURSDAY",
    4: "FRIDAY", 5: "SATURDAY", 6: "SUNDAY"
};

const DAY_MAP_API_STRING_TO_NUMERIC: { [key: string]: number } = Object.fromEntries(
  ALL_DAYS_API_FORMAT.map((apiDay) => [apiDay, ALL_DAYS_DISPLAY_FORMAT.findIndex(displayDay => DAY_MAP_DISPLAY_TO_API_STRING[displayDay] === apiDay)])
);


const DEFAULT_CHARGE_LIMIT = 32;
const CHARGE_LIMIT_OPTIONS = [6, 8.5, 10, 12, 16, 24, 32];


const EVChargerPage = () => {
  const [evChargerData, setEvChargerData] = useState<any>(null);
  const [isLoadingEvData, setIsLoadingEvData] = useState(true);
  const { apiKey, isLoadingApiKey, inverterSerial, evChargerId: storedEvChargerId } = useApiKey();
  const { toast } = useToast();

  const {
    schedules: localSchedules,
    addSchedule: addLocalSchedule,
    updateSchedule: updateLocalSchedule,
    deleteSchedule: deleteLocalSchedule,
    isLoading: isLoadingLocalSchedules,
    reloadSchedules: reloadLocalSchedulesFromHook,
    moveScheduleUp,
    moveScheduleDown,
  } = useLocalStorageSchedules(storedEvChargerId || "unknown-charger");

  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<NamedEVChargerSchedule | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<NamedEVChargerSchedule | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const [deviceActiveScheduleName, setDeviceActiveScheduleName] = useState<string | null>(null);
  const [isLoadingDeviceSchedule, setIsLoadingDeviceSchedule] = useState(false);
  const [isSyncingFromDevice, setIsSyncingFromDevice] = useState(false);


  const [settingsLegacy, setSettingsLegacy] = useState<any>({
    solarCharging: false,
    plugAndCharge: false,
    maxBatteryDischargeToEvc: 0,
    chargeRate: 6,
  });
  const { theme } = useTheme();

  const [commandChargePowerLimit, setCommandChargePowerLimit] = useState<{ value: number; unit: string; min: number; max: number; } | null>(null);
  const [commandSessionEnergyLimit, setCommandSessionEnergyLimit] = useState<{ value: number | null; unit: string; min: number; max: number; } | null>(null);
  const [isLoadingCommandSettings, setIsLoadingCommandSettings] = useState(true);
  const [inputSessionEnergyLimit, setInputSessionEnergyLimit] = useState<string>("");

  const [chargingSessionsData, setChargingSessionsData] = useState<any[]>([]);
  const [isLoadingChargingSessions, setIsLoadingChargingSessions] = useState(false);
  const [chargingSessionsPage, setChargingSessionsPage] = useState(1);
  const [hasMoreChargingSessions, setHasMoreChargingSessions] = useState(true);
  const [sessionFilterStartDate, setSessionFilterStartDate] = useState<Date | undefined>(subDays(new Date(), 1));
  const [sessionFilterEndDate, setSessionFilterEndDate] = useState<Date | undefined>(new Date());

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hideNaEnergy, setHideNaEnergy] = useState<boolean>(true);
  const [uniqueSessionStatuses, setUniqueSessionStatuses] = useState<string[]>([]);


  const evChargerStatusMap: { [key: string]: string } = {
      Available: 'The EV charger is not plugged in to a vehicle',
      Preparing: 'The EV charger is plugged into a vehicle and is ready to start a charge',
      Charging: 'The EV charger is charging the connected EV',
      SuspendedEVSE: 'The charging session has been stopped by the EV charger',
      SuspendedEV: 'The charging session has been stopped by the EV',
      Finishing: 'The charging session has finished, but the EV charger is not ready to start a new charging session',
      Reserved: 'The EV charger has been reserved for a future charging session',
      Unavailable: 'The EV charger cannot start new charging sessions',
      Faulted: 'The EV charger is reporting an error',
      Unknown: 'Unknown Status',
  };

  const evChargerStatusColorMap: { [key: string]: string } = {
      Available: 'text-blue-400',
      Preparing: 'text-blue-500',
      Charging: 'text-green-500',
      SuspendedEVSE: 'text-orange-500',
      SuspendedEV: 'text-orange-500',
      Finishing: 'text-red-600',
  };

  const chargePowerLimitPresets = [6, 8.5, 10, 12, 16, 24, 32];


  const getAuthHeaders = useCallback(() => {
    if (!apiKey) return {};
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }, [apiKey]);

  const handleApiError = useCallback(async (response: Response, operationName: string) => {
    let errorPayload: { error?: string; message?: string; details?: any } = {
      message: `Error ${operationName}: Request failed with status ${response.status}`,
    };
    try {
      const parsedJson = await response.json();
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        if (parsedJson.error || parsedJson.message) {
          errorPayload = { ...parsedJson, ...errorPayload, message: parsedJson.message || parsedJson.error || errorPayload.message };
        } else if (parsedJson.data && (parsedJson.data.error || parsedJson.data.message)) {
          errorPayload = { ...parsedJson.data, ...errorPayload, message: parsedJson.data.message || parsedJson.data.error || errorPayload.message };
        } else if (Object.keys(parsedJson).length === 0 && response.status !== 204) {
          errorPayload.details = "Response was an empty JSON object.";
        } else {
          errorPayload.details = parsedJson;
        }
      } else {
         errorPayload.details = "Response was not a standard JSON error object.";
      }
    } catch (e) {
      errorPayload.details = `Response was not valid JSON. Status: ${response.status} ${response.statusText}`;
    }
    console.error(`Error in ${operationName}:`, errorPayload.error || errorPayload.message, errorPayload.details ? errorPayload.details : '');
    toast({
      variant: "destructive",
      title: `${operationName.charAt(0).toUpperCase() + operationName.slice(1)} Failed`,
      description: String(errorPayload.message || errorPayload.error || `An unknown error occurred during ${operationName}. Status: ${response.status}`),
    });
  }, [toast]);

  const fetchLegacySettings = useCallback(async (chargerUuid: string | null) => {
    if (!apiKey || !chargerUuid) return;
    try {
      const headers = getAuthHeaders();
      const plugAndChargeResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/read/616`, { headers }); // Assumes read for 616 is GET
      const plugAndChargeData = await plugAndChargeResponse.json();
      const plugAndChargeEnabled = plugAndChargeData?.data?.value === 1; // Or however the API indicates enabled

      const chargeRateResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/read/621`, { headers });
      const chargeRateData = await chargeRateResponse.json();
      const chargeRateLimit = chargeRateData?.data?.value;

      const batteryDischargeResponse = await fetch(`/api/proxy-givenergy/inverter/${inverterSerial}/settings/107/read`, { headers });
      const batteryDischargeData = await batteryDischargeResponse.json();
      const maxBatteryDischargeToEvcSetting = batteryDischargeData?.data?.value || 0;

      setSettingsLegacy((prevSettings: any) => ({
        ...prevSettings,
        plugAndCharge: plugAndChargeEnabled,
        chargeRate: chargeRateLimit || prevSettings.chargeRate,
        maxBatteryDischargeToEvc: maxBatteryDischargeToEvcSetting,
      }));
    } catch (error) {
      console.error('Error fetching legacy settings:', error);
    }
  }, [apiKey, getAuthHeaders, inverterSerial]);


 const fetchDeviceActiveScheduleInfo = useCallback(async (chargerUuid: string) => {
    if (!apiKey || !chargerUuid) return;
    setIsLoadingDeviceSchedule(true);
    setDeviceActiveScheduleName(null);
    try {
        const headers = getAuthHeaders();
        const response = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/commands/set-schedule`, { headers, cache: 'no-store' });

        if (!response.ok) {
            if (response.status === 404) {
                toast({ title: "No Schedules on Device", description: "The EV charger does not appear to have any schedules configured." });
            } else {
                await handleApiError(response, 'fetching device active schedule');
            }
            setDeviceActiveScheduleName(null);
            return;
        }

        const scheduleListResponse = await response.json() as EVChargerDeviceScheduleListResponse;

        if (scheduleListResponse && scheduleListResponse.data && Array.isArray(scheduleListResponse.data.schedules)) {
            const activeDeviceScheduleEntry = scheduleListResponse.data.schedules.find(s => s.is_active);
            if (activeDeviceScheduleEntry) {
                setDeviceActiveScheduleName(activeDeviceScheduleEntry.name);
            } else {
                 setDeviceActiveScheduleName(null);
            }
        } else {
            toast({ title: "Schedule Data Format Error", description: "Received an empty or unexpected schedule format from the device." });
            setDeviceActiveScheduleName(null);
        }
    } catch (error) {
        console.error('Error fetching device active schedule info:', error);
        toast({ variant: "destructive", title: "Fetch Active Schedule Error", description: "Could not load device's active schedule information." });
        setDeviceActiveScheduleName(null);
    } finally {
        setIsLoadingDeviceSchedule(false);
    }
  }, [apiKey, getAuthHeaders, toast, handleApiError]);


  const syncSchedulesFromDevice = async () => {
    if (!apiKey || !evChargerData?.uuid) {
      toast({ variant: "destructive", title: "Error", description: "API Key or EV Charger ID missing." });
      return;
    }
    setIsSyncingFromDevice(true);
    let activeDeviceScheduleNameFromSync: string | null = null;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/set-schedule`, { headers, cache: 'no-store' });

      if (!response.ok) {
        await handleApiError(response, 'syncing schedules from device');
        return;
      }

      const scheduleListResponse = await response.json() as EVChargerDeviceScheduleListResponse;

      if (scheduleListResponse && scheduleListResponse.data && Array.isArray(scheduleListResponse.data.schedules)) {
        let importedCount = 0;
        let updatedCount = 0;

        for (const deviceSchedule of scheduleListResponse.data.schedules) {
          if (deviceSchedule.periods && deviceSchedule.periods.length > 0) {
            const firstPeriod = deviceSchedule.periods[0];
            const apiDays: string[] = firstPeriod.days
              .map(dayNum => NUMERIC_DAY_TO_API_DAY_STRING[dayNum])
              .filter((dayStr): dayStr is string => !!dayStr);

            const scheduleToSave: Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'> = {
              name: deviceSchedule.name || `Device Schedule ${deviceSchedule.id || 'UnknownID'}`,
              rules: [{
                start_time: firstPeriod.start_time,
                end_time: firstPeriod.end_time,
                days: apiDays,
                limit: firstPeriod.limit ?? DEFAULT_CHARGE_LIMIT,
              }],
            };

            const result = addLocalSchedule(scheduleToSave);
            if (result.type === 'added') importedCount++;
            if (result.type === 'updated') updatedCount++;

            if (deviceSchedule.is_active) {
              activeDeviceScheduleNameFromSync = scheduleToSave.name;
            }
          }
        }

        toast({ title: "Update from Device Complete", description: `${importedCount} new schedules added, ${updatedCount} existing schedules updated.` });
        reloadLocalSchedulesFromHook(); 
      } else {
        toast({ variant: "destructive", title: "Update Error", description: "Unexpected schedule format from device during update." });
      }

    } catch (error) {
      console.error('Error updating schedules from device:', error);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update schedules from device." });
    } finally {
      setIsSyncingFromDevice(false);
      if (activeDeviceScheduleNameFromSync) {
        setDeviceActiveScheduleName(activeDeviceScheduleNameFromSync);
      } else if (evChargerData?.uuid) {
        fetchDeviceActiveScheduleInfo(evChargerData.uuid);
      }
    }
  };

  const handleActivateScheduleOnDevice = async (schedule: NamedEVChargerSchedule) => {
    if (!apiKey || !evChargerData?.uuid) return;
    if (!schedule.rules || schedule.rules.length === 0) {
        toast({ variant: "destructive", title: "Invalid Schedule", description: "The selected local schedule has no rules to send." });
        return;
    }

    setIsLoadingDeviceSchedule(true);

    const firstRule = schedule.rules[0];
    const apiNumericDays: number[] = firstRule.days
        .map(displayDayOrApiDay => {
            let apiDayString = DAY_MAP_DISPLAY_TO_API_STRING[displayDayOrApiDay];
            if (!apiDayString) { 
                apiDayString = displayDayOrApiDay.toUpperCase();
            }
            return DAY_MAP_API_STRING_TO_NUMERIC[apiDayString];
        })
        .filter((dayNum): dayNum is number => dayNum !== undefined && dayNum !== null);


    if (apiNumericDays.length !== firstRule.days.length) {
        const problematicDays = firstRule.days.filter(d => !DAY_MAP_DISPLAY_TO_API_STRING[d] && !DAY_MAP_API_STRING_TO_NUMERIC[d.toUpperCase()]);
        toast({ variant: "destructive", title: "Day Mapping Error", description: `Could not convert days: ${problematicDays.join(', ')} to API numeric format.` });
        setIsLoadingDeviceSchedule(false);
        return;
    }

    const devicePeriods: RawDeviceApiPeriod[] = [{
        start_time: firstRule.start_time,
        end_time: firstRule.end_time,
        days: apiNumericDays,
        limit: firstRule.limit ?? DEFAULT_CHARGE_LIMIT
    }];

    const payloadToDevice: EVChargerSetSchedulePayload = {
      name: schedule.name,
      is_active: true,
      periods: devicePeriods,
    };

    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/set-schedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadToDevice),
      });
      if (!response.ok) {
        await handleApiError(response, 'activating schedule on device');
        return;
      }
      const result = await response.json();
      if (result && (result.success || (result.data && (result.data.success || result.data.message)))) {
        toast({ title: "Schedule Activated on Device", description: `Schedule "${schedule.name}" is now active. ${result.data?.message || ""}` });
        fetchDeviceActiveScheduleInfo(evChargerData.uuid);
      } else {
        toast({ variant: "destructive", title: "Activation Not Confirmed", description: result.data?.message || result.error || "Failed to activate schedule. Check API response." });
      }
    } catch (error) {
      console.error('Error activating schedule on device:', error);
      toast({ variant: "destructive", title: "Activation Error", description: "An unexpected error occurred." });
    } finally {
      setIsLoadingDeviceSchedule(false);
    }
  };

  const handleOpenScheduleDialog = (schedule: NamedEVChargerSchedule | null = null) => {
    setEditingSchedule(schedule);
    setIsScheduleDialogOpen(true);
  };

  const handleSaveLocalSchedule = (scheduleData: Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const wasActiveBeforeEdit = editingSchedule?.name === deviceActiveScheduleName;
    let savedScheduleName = scheduleData.name;
    let savedScheduleId = scheduleData.id;

    if (editingSchedule && scheduleData.id) {
      updateLocalSchedule(scheduleData.id, scheduleData);
      toast({title: "Local Schedule Updated", description: `Schedule "${scheduleData.name}" saved locally.`});
    } else {
      const {id: newId} = addLocalSchedule(scheduleData);
      savedScheduleId = newId;
      toast({title: "Local Schedule Added", description: `Schedule "${scheduleData.name}" added to your local list.`});
    }
    setIsScheduleDialogOpen(false);

    if (wasActiveBeforeEdit && savedScheduleId && evChargerData?.uuid) {
        const fullScheduleForActivation: NamedEVChargerSchedule = {
            ...scheduleData,
            id: savedScheduleId,
            rules: scheduleData.rules || [],
            createdAt: editingSchedule?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        handleActivateScheduleOnDevice(fullScheduleForActivation);
        toast({ title: "Device Update Sent", description: `Changes to active schedule "${savedScheduleName}" sent to EV Charger.`});
    } else if (savedScheduleId && scheduleData.name === deviceActiveScheduleName && evChargerData?.uuid && !wasActiveBeforeEdit) {
        fetchDeviceActiveScheduleInfo(evChargerData.uuid);
    }
    setEditingSchedule(null);
  };

  const handleDeleteLocalScheduleClick = (schedule: NamedEVChargerSchedule) => {
    setScheduleToDelete(schedule);
    setIsDeleteAlertOpen(true);
  };

  const confirmDeleteLocalSchedule = () => {
    if (scheduleToDelete) {
      const wasActive = scheduleToDelete.name === deviceActiveScheduleName;
      deleteLocalSchedule(scheduleToDelete.id);
      toast({title: "Local Schedule Deleted", description: `Schedule "${scheduleToDelete.name}" removed from your list.`});

      if (wasActive) {
        setDeviceActiveScheduleName(null);
        toast({
            variant: "default",
            title: "Device Schedule Note",
            description: `Schedule "${scheduleToDelete.name}" was deleted locally. It may still be active on the device until another schedule is activated.`,
            duration: 8000
        });
      }
    }
    setIsDeleteAlertOpen(false);
    setScheduleToDelete(null);
  };


  const fetchCurrentChargePowerLimit = useCallback(async (chargerUuid: string) => {
    if (!apiKey || !chargerUuid) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/commands/adjust-charge-power-limit`, { headers });
      if (!response.ok) {
        await handleApiError(response, 'fetching charge power limit');
        setCommandChargePowerLimit(null);
        return;
      }
      const data = await response.json();
      if (data && data.data) {
        setCommandChargePowerLimit(data.data);
      } else {
        setCommandChargePowerLimit(null);
      }
    } catch (error) {
      console.error('Error fetching charge power limit:', error);
      setCommandChargePowerLimit(null);
    }
  }, [apiKey, getAuthHeaders, handleApiError]);


  const fetchCurrentSessionEnergyLimit = useCallback(async (chargerUuid: string) => {
    if (!apiKey || !chargerUuid) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/commands/set-session-energy-limit`, { headers });
      if (!response.ok) {
        await handleApiError(response, 'fetching session energy limit');
        setCommandSessionEnergyLimit(null);
        setInputSessionEnergyLimit("");
        return;
      }
      const data = await response.json();
      if (data && data.data) {
        setCommandSessionEnergyLimit(data.data);
        setInputSessionEnergyLimit(data.data.value !== null ? String(data.data.value) : "");
      } else {
        setCommandSessionEnergyLimit(null);
        setInputSessionEnergyLimit("");
      }
    } catch (error) {
      console.error('Error fetching session energy limit:', error);
      setCommandSessionEnergyLimit(null);
      setInputSessionEnergyLimit("");
    }
  }, [apiKey, getAuthHeaders, handleApiError]);

  const fetchEvChargerData = useCallback(async (isSoftRefresh?: boolean) => {
    if (!apiKey) {
      if (!isSoftRefresh) setIsLoadingEvData(false);
      setEvChargerData(null);
      return;
    }
    if (!isSoftRefresh) {
      setIsLoadingEvData(true);
    }
    try {
      const headers = getAuthHeaders();
      const chargerResponse = await fetch('/api/proxy-givenergy/ev-charger', { headers });
      if (!chargerResponse.ok) {
        await handleApiError(chargerResponse, 'fetching EV charger list');
        setEvChargerData(null);
        if (!isSoftRefresh) setIsLoadingEvData(false);
        return;
      }
      const chargerListData = await chargerResponse.json();

      let chargerUuid = null;
      if (chargerListData && chargerListData.data && chargerListData.data.length > 0 && chargerListData.data[0].uuid) {
        chargerUuid = chargerListData.data[0].uuid;
      } else if (storedEvChargerId) {
        chargerUuid = storedEvChargerId;
      }

      if (chargerUuid) {
        setEvChargerData((prev: any) => ({ ...prev, uuid: chargerUuid }));

        const specificChargerResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}`, { headers });
        if (!specificChargerResponse.ok) {
          await handleApiError(specificChargerResponse, `fetching EV charger ${chargerUuid}`);
          if (!isSoftRefresh) setIsLoadingEvData(false);
          return;
        }
        const specificChargerData = await specificChargerResponse.json();

        if (specificChargerData && specificChargerData.data) {
          const chargerDetails = specificChargerData.data;
          setEvChargerData((prevData: any) => ({
            ...prevData,
            uuid: chargerDetails.uuid,
            online: chargerDetails.online,
            status: chargerDetails.status,
            type: chargerDetails.type,
            serial_number: chargerDetails.serial_number,
            alias: chargerDetails.alias,
            went_offline_at: chargerDetails.went_offline_at
          }));

          const meterResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/meter-data`, { headers });
          if (!meterResponse.ok) {
            console.warn(`Failed to fetch meter data for EV charger ${chargerUuid}. Status: ${meterResponse.status}`);
             setEvChargerData((prevData: any) => ({ ...prevData, current_power: null }));
          } else {
            const meterData = await meterResponse.json();
            let currentPower = null;
            if (meterData && meterData.data && meterData.data.length > 0 && meterData.data[0].measurements) {
                const latestMeterReading = meterData.data[0];
                const powerMeasurement = latestMeterReading.measurements.find((m: any) => m.measurand === 13);
                if (powerMeasurement) {
                    currentPower = powerMeasurement.value;
                }
            }
            setEvChargerData((prevData: any) => ({ ...prevData, current_power: currentPower }));
          }
          fetchDeviceActiveScheduleInfo(chargerDetails.uuid);

        } else {
          if (!isSoftRefresh) setEvChargerData(null);
        }
      } else {
        setEvChargerData(null);
        if (!isSoftRefresh) {
          toast({
            variant: "default",
            title: "No EV Charger Found",
            description: "No EV charger was found associated with your API key.",
          });
        }
      }
    } catch (error) {
      console.error('Error fetching EV charger data:', error);
      if (!isSoftRefresh) setEvChargerData(null);
    } finally {
      if (!isSoftRefresh) {
        setIsLoadingEvData(false);
      }
    }
  }, [apiKey, storedEvChargerId, getAuthHeaders, toast, fetchDeviceActiveScheduleInfo, handleApiError]);


 const fetchChargingSessions = useCallback(async (page = 1, append = false, startDate?: Date, endDate?: Date) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setIsLoadingChargingSessions(true);
    try {
        const headers = getAuthHeaders();
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('pageSize', '50');

        if (startDate) {
            params.append('start_time', formatISO(startDate, { representation: 'date' }));
        }
        if (endDate) {
             params.append('end_time', formatISO(endDate, { representation: 'date' }));
        }

        const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/charging-sessions?${params.toString()}`, { headers });

        if (!response.ok) {
            await handleApiError(response, 'fetching charging sessions');
            setChargingSessionsData([]);
            setHasMoreChargingSessions(false);
            return;
        }
        const result = await response.json();
        if (result && result.data) {
            const sortedData = result.data.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
            const currentData = append ? [...chargingSessionsData, ...sortedData] : sortedData;
            setChargingSessionsData(currentData);

            const statuses = new Set(currentData.map((session: any) => session.stop_reason || (session.stopped_at ? 'Completed' : 'Active')));
            setUniqueSessionStatuses(Array.from(statuses));

            setChargingSessionsPage(page);
            setHasMoreChargingSessions(result.data.length > 0 && result.meta && result.meta.current_page < result.meta.last_page);
        } else {
            setChargingSessionsData(append ? chargingSessionsData : []);
            setUniqueSessionStatuses([]);
            setHasMoreChargingSessions(false);
        }
    } catch (error) {
        console.error('Error fetching charging sessions:', error);
        setChargingSessionsData(append ? chargingSessionsData : []);
        setUniqueSessionStatuses([]);
        setHasMoreChargingSessions(false);
        toast({ variant: "destructive", title: "Fetch Sessions Error", description: "Could not load charging sessions." });
    } finally {
        setIsLoadingChargingSessions(false);
    }
}, [apiKey, evChargerData?.uuid, getAuthHeaders, toast, chargingSessionsData, handleApiError]);


  useEffect(() => {
    if (!isLoadingApiKey && apiKey) {
      fetchEvChargerData();
    } else if (!isLoadingApiKey && !apiKey) {
      setIsLoadingEvData(false);
      setEvChargerData(null);
    }
  }, [apiKey, isLoadingApiKey, fetchEvChargerData]);

  useEffect(() => {
    if (evChargerData?.uuid && apiKey) {
      setIsLoadingCommandSettings(true);
      Promise.all([
        fetchLegacySettings(evChargerData.uuid),
        fetchCurrentChargePowerLimit(evChargerData.uuid),
        fetchCurrentSessionEnergyLimit(evChargerData.uuid),
        fetchChargingSessions(1, false, sessionFilterStartDate, sessionFilterEndDate)
      ]).finally(() => {
        setIsLoadingCommandSettings(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evChargerData?.uuid, apiKey]);


  const handleStartCharge = async () => {
    if (!apiKey || !evChargerData?.uuid) return;
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/start-charge`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        await handleApiError(response, 'starting charge');
        return;
      }
      const data = await response.json();
      if (data && data.data && data.data.success) {
        toast({ title: "Start Charge Sent", description: data.data.message || "Command accepted." });
      } else {
        toast({ variant: "destructive", title: "Start Charge Not Confirmed", description: data?.data?.message || data?.error || data?.message || "Command sent, but success not confirmed by API." });
      }
      fetchEvChargerData(true);
    } catch (error) {
      console.error('Network or unexpected error starting charge:', error);
      toast({ variant: "destructive", title: "Start Charge Error", description: "An unexpected error occurred." });
    }
  };

  const handleStopCharge = async () => {
    if (!apiKey || !evChargerData?.uuid) return;
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/stop-charge`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        await handleApiError(response, 'stopping charge');
        return;
      }
      const data = await response.json();
       if (data && data.data && data.data.success) {
        toast({ title: "Stop Charge Sent", description: data.data.message || "Command accepted." });
      } else {
        toast({ variant: "destructive", title: "Stop Charge Not Confirmed", description: data?.data?.message || data?.error || data?.message || "Command sent, but success not confirmed by API." });
      }
      fetchEvChargerData(true);
    } catch (error) {
      console.error('Network or unexpected error stopping charge:', error);
      toast({ variant: "destructive", title: "Stop Charge Error", description: "An unexpected error occurred." });
    }
  };

  const handleAdjustChargePowerLimit = async (newLimit: number) => {
    if (!apiKey || !evChargerData?.uuid) return;
    if (isNaN(newLimit)) {
        toast({variant: "destructive", title: "Invalid Limit", description: "Selected charge power limit is not a valid number."});
        return;
    }
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/adjust-charge-power-limit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ limit: newLimit }),
      });
      if (!response.ok) {
        await handleApiError(response, 'adjusting charge power limit');
        fetchCurrentChargePowerLimit(evChargerData.uuid);
        return;
      }
      const data = await response.json();
      if (data?.data?.success) {
        toast({ title: "Charge Power Limit Updated", description: data.data.message || "Command accepted." });
        fetchCurrentChargePowerLimit(evChargerData.uuid);
      } else {
        toast({ variant: "destructive", title: "Update Not Confirmed", description: data?.data?.message || "Failed to update charge power limit." });
        fetchCurrentChargePowerLimit(evChargerData.uuid);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Command Error", description: "Failed to set charge power limit." });
      if (evChargerData?.uuid) fetchCurrentChargePowerLimit(evChargerData.uuid);
    }
  };


  const handleSetSessionEnergyLimit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiKey || !evChargerData?.uuid) return;
    const limitValue = parseFloat(inputSessionEnergyLimit);
    if (isNaN(limitValue) || limitValue < 0.1 || limitValue > 250) {
        toast({ variant: "destructive", title: "Invalid Input", description: "Session energy limit must be between 0.1 and 250 kWh." });
        return;
    }
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/set-session-energy-limit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ limit: limitValue }),
      });
      if (!response.ok) {
        await handleApiError(response, 'setting session energy limit');
        return;
      }
      const data = await response.json();
      if (data?.data?.success) {
        toast({ title: "Session Energy Limit Updated", description: data.data.message || "Command accepted." });
        fetchCurrentSessionEnergyLimit(evChargerData.uuid);
      } else {
        toast({ variant: "destructive", title: "Update Not Confirmed", description: data?.data?.message || "Failed to update session energy limit." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Command Error", description: "Failed to set session energy limit." });
    }
  };

  const handleToggleSolarCharging = async (checked: boolean) => {
    if (!apiKey || !inverterSerial) return;
    setSettingsLegacy((prevSettings: any) => ({ ...prevSettings, solarCharging: checked }));
    try {
      const response = await fetch(`/api/proxy-givenergy/inverter/${inverterSerial}/settings/106/write`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: checked ? 2 : 0 }),
      });
      if (!response.ok) {
        await handleApiError(response, 'toggling solar charging');
        return;
      }
      toast({title: "Solar Charging Setting Updated"});
    } catch (error) {
      toast({ variant: "destructive", title: "Solar Charging Error", description: "An unexpected error occurred." });
    }
  };

  const handleTogglePlugAndCharge = async (checked: boolean) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setSettingsLegacy((prevSettings: any) => ({ ...prevSettings, plugAndCharge: checked }));
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/set-plug-and-go`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled: checked }),
      });
      if (!response.ok) {
         await handleApiError(response, 'toggling plug and charge (settings)');
         if (evChargerData.uuid) fetchLegacySettings(evChargerData.uuid);
        return;
      }
      const data = await response.json();
      if (data?.data?.success) {
        toast({title: "Plug & Charge Setting Updated", description: data.data.message});
      } else {
         toast({title: "Plug & Charge Setting Update Sent", description: data.data.message || "Command sent, API confirmation pending."});
      }
      if (evChargerData.uuid) fetchLegacySettings(evChargerData.uuid);
    } catch (error) {
      toast({ variant: "destructive", title: "Plug & Charge Error", description: "An unexpected error occurred." });
      if (evChargerData.uuid) fetchLegacySettings(evChargerData.uuid);
    }
  };

  const handleSetMaxBatteryDischargeToEvc = async (value: number[]) => {
     if (!apiKey || !inverterSerial) return;
    setSettingsLegacy((prevSettings: any) => ({ ...prevSettings, maxBatteryDischargeToEvc: value[0] * 1000 }));
    try {
      const response = await fetch(`/api/proxy-givenergy/inverter/${inverterSerial}/settings/107/write`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: value[0] * 1000 }),
      });
      if (!response.ok) {
        await handleApiError(response, 'setting max battery discharge');
        return;
      }
      toast({title: "Battery Discharge to EVC Updated"});
    } catch (error) {
      toast({ variant: "destructive", title: "Battery Discharge Error", description: "An unexpected error occurred." });
    }
  };

  const handleSetChargeRate = useCallback(async (value: number[]) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setSettingsLegacy((prevSettings: any) => ({ ...prevSettings, chargeRate: value[0] }));
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/settings/621/write`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: value[0] }),
      });
      if (!response.ok) {
        await handleApiError(response, 'setting charge rate (settings)');
        return;
      }
      toast({title: "Charge Rate Limit (Register) Updated"});
    } catch (error) {
      toast({ variant: "destructive", title: "Charge Rate Error", description: "An unexpected error occurred." });
    }
  }, [apiKey, evChargerData?.uuid, getAuthHeaders, toast, handleApiError]);

  const handleSessionSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fetchChargingSessions(1, false, sessionFilterStartDate, sessionFilterEndDate);
  };

  const renderStatusValue = (label: string, value: any, icon?: React.ReactNode, unit?: string) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const displayValue = (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value);
    if (label === "Last Offline" && evChargerData?.went_offline_at === null) {
        return null;
    }
    return (
      <div className="flex items-center py-2 border-b border-border/50 last:border-b-0">
        {icon && <span className="mr-2 text-muted-foreground">{icon}</span>}
        <span className="text-sm text-muted-foreground mr-2">{label}:</span>
        <span className="text-sm font-medium text-foreground">
          {displayValue}
          {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
        </span>
      </div>
    );
  };

  const displayedSessions = React.useMemo(() => {
    return chargingSessionsData
      .filter(session => {
        if (statusFilter === 'all') return true;
        const sessionStatus = session.stop_reason || (session.stopped_at ? 'Completed' : 'Active');
        return sessionStatus === statusFilter;
      })
      .filter(session => {
        if (!hideNaEnergy) return true;
        let energyDisplay = "N/A";
        if (typeof session.kwh_delivered === 'number') {
            energyDisplay = (session.kwh_delivered).toFixed(2);
        } else if (typeof session.meter_start === 'number' && typeof session.meter_stop === 'number' && session.meter_stop > session.meter_start) {
            const energyWh = session.meter_stop - session.meter_start;
            if (energyWh > 0) {
              const energyKWh = energyWh / 1000;
              energyDisplay = energyKWh.toFixed(2);
            }
        }
        return energyDisplay !== "N/A";
      });
  }, [chargingSessionsData, statusFilter, hideNaEnergy]);

  const chartSessionData = React.useMemo(() => {
    return displayedSessions
      .map(session => {
        let energyKWh = 0;
        if (typeof session.kwh_delivered === 'number') {
          energyKWh = parseFloat(session.kwh_delivered.toFixed(2));
        } else if (typeof session.meter_start === 'number' && typeof session.meter_stop === 'number' && session.meter_stop > session.meter_start) {
          const energyWh = session.meter_stop - session.meter_start;
          energyKWh = parseFloat((energyWh / 1000).toFixed(2));
        }

        let durationMinutes = 0;
        if (session.started_at && session.stopped_at) {
            durationMinutes = differenceInMinutes(parseISO(session.stopped_at), parseISO(session.started_at));
        }

        return {
          id: session.id || session.started_at,
          formattedStartTime: session.started_at ? format(parseISO(session.started_at), "MMM d, HH:mm") : 'N/A',
          energyKWh: energyKWh,
          durationMinutes: durationMinutes > 0 ? durationMinutes : null,
          stopReason: session.stop_reason || (session.stopped_at ? 'Completed' : 'Active'),
        };
      })
      .filter(item => item.energyKWh > 0)
      .sort((a,b) => (a.formattedStartTime === 'N/A' || b.formattedStartTime === 'N/A') ? 0 : new Date(parseISO(a.id)).getTime() - new Date(parseISO(b.id)).getTime());
  }, [displayedSessions]);

  const dailyEnergyChartData = React.useMemo(() => {
    if (!displayedSessions || displayedSessions.length === 0) {
      return [];
    }

    const dailyTotals: { [date: string]: number } = {};

    displayedSessions.forEach(session => {
      if (!session.started_at) return;

      const sessionDate = format(parseISO(session.started_at), "yyyy-MM-dd");
      let energyKWh = 0;

      if (typeof session.kwh_delivered === 'number') {
        energyKWh = session.kwh_delivered;
      } else if (typeof session.meter_start === 'number' && typeof session.meter_stop === 'number' && session.meter_stop > session.meter_start) {
        const energyWh = session.meter_stop - session.meter_start;
        energyKWh = energyWh / 1000;
      }

      if (energyKWh > 0) {
        if (dailyTotals[sessionDate]) {
          dailyTotals[sessionDate] += energyKWh;
        } else {
          dailyTotals[sessionDate] = energyKWh;
        }
      }
    });

    return Object.entries(dailyTotals)
      .map(([date, totalEnergyKWh]) => ({
        date,
        formattedDate: format(parseISO(date), "MMM d, yy"),
        totalEnergyKWh: parseFloat(totalEnergyKWh.toFixed(2)),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [displayedSessions]);


  const formatScheduleRulesForDisplay = (rules: EVChargerAPIRule[]): string => {
    if (!rules || rules.length === 0) return "No rules defined.";
    return rules.map(rule => {
        const days = rule.days.map(d => DAY_MAP_API_TO_DISPLAY[d.toUpperCase()] || d).join(', ');
        const limitString = rule.limit ? ` @ ${rule.limit}A` : '';
        return `${days}: ${rule.start_time} - ${rule.end_time}${limitString}`;
    }).join('; ');
  };

  const canStartCharging = useMemo(() => {
    if (!evChargerData?.online || !evChargerData?.status) return false;
    const startableStatuses = ['Available', 'Preparing', 'SuspendedEVSE', 'SuspendedEV'];
    return startableStatuses.includes(evChargerData.status);
  }, [evChargerData?.online, evChargerData?.status]);

  const canStopCharging = useMemo(() => {
    if (!evChargerData?.online || !evChargerData?.status) return false;
    return evChargerData.status === 'Charging';
  }, [evChargerData?.online, evChargerData?.status]);


  return (
    <>
      {isLoadingApiKey || isLoadingEvData ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Loading EV Charger Details...</p>
        </div>
      ) : !apiKey ? (
        <div className="min-h-screen p-4 md:p-8">
           <Card>
            <CardHeader><CardTitle>API Key Required</CardTitle></CardHeader>
            <CardContent><p>Please set your GivEnergy API key in the main application settings to use EV Charger features.</p></CardContent>
           </Card>
        </div>
      ) : (
        <div className="min-h-screen p-4 md:p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-primary">EV Charger</h1>
            <div className="flex items-center space-x-4">
              <Link href="/" passHref>
                <Button variant="outline" className="flex items-center">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
                </Button>
              </Link>
            </div>
          </div>
          {!evChargerData?.uuid && !isLoadingEvData ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center"><AlertCircle className="mr-2 text-destructive"/>EV Charger Not Found</CardTitle></CardHeader>
              <CardContent><p>No EV charger details could be retrieved. Please ensure your API key is correct, your EV charger is registered with GivEnergy, and it's online. You can check your API key in the settings (gear icon in the header).</p></CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
                <TabsTrigger value="overview"><PlugZap className="mr-2 h-4 w-4" />Overview</TabsTrigger>
                <TabsTrigger value="schedules"><CalendarDays className="mr-2 h-4 w-4" />Schedules</TabsTrigger>
                <TabsTrigger value="analytics"><LineChart className="mr-2 h-4 w-4" />Analytics</TabsTrigger>
                <TabsTrigger value="settings"><Settings className="mr-2 h-4 w-4" />Settings (Legacy)</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5"/>Charger Status</CardTitle>
                        {evChargerData?.status && evChargerData?.online && (
                          <div className="text-sm text-muted-foreground">Status: <span className={`font-medium ${evChargerStatusColorMap[evChargerData.status] || 'text-foreground'}`}>{mapEVChargerAPIStatus(evChargerData.status) || 'Unknown'}</span> <span className="ml-1 text-xs">{evChargerStatusMap[evChargerData.status] || 'No description available'}</span></div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-6 pb-0 border-b border-border/50">
                          <div className="space-y-1">
                              {renderStatusValue("Charger", evChargerData?.alias, <FileText />)}
                              {renderStatusValue("Online", evChargerData?.online ? 'Yes' : 'No', evChargerData?.online ? <Wifi color="green"/> : <WifiOff color="red"/> )}
                              {renderStatusValue("Current Power", evChargerData?.current_power, <Power/>, "W")}
                              {renderStatusValue("Last Offline", evChargerData?.went_offline_at ? format(parseISO(evChargerData.went_offline_at), "PPpp") : null, <CalendarDays />)}
                          </div>
                      </CardContent>

                      <CardHeader className="pt-6">
                        <CardTitle className="flex items-center"><Power className="mr-2 h-5 w-5"/>Instant Control</CardTitle>
                       </CardHeader>
                      <CardContent className="space-y-6 pt-0">
                         {isLoadingCommandSettings ? (
                           <div className="flex justify-center items-center py-8">
                             <Loader2 className="h-6 w-6 animate-spin text-primary" />
                             <p className="ml-2">Loading controls...</p>
                           </div>
                         ) : (
                           <>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <Button onClick={handleStartCharge} className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={isLoadingCommandSettings || !canStartCharging}>Start Charging</Button>
                              <Button onClick={handleStopCharge} className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isLoadingCommandSettings || !canStopCharging}>Stop Charging</Button>
                            </div>

                            <div>
                              <Label className="mb-2 block">Charge Power Limit ({commandChargePowerLimit?.unit || "A"})</Label>
                               <div className="flex flex-wrap gap-2">
                                {chargePowerLimitPresets.map(limit => (
                                  <Button
                                    key={limit}
                                    size="sm"
                                    variant={commandChargePowerLimit?.value === limit ? "default" : "outline"}
                                    onClick={() => handleAdjustChargePowerLimit(limit)}
                                    disabled={isLoadingCommandSettings}
                                    className="flex-grow sm:flex-grow-0"
                                  >
                                    {limit} {commandChargePowerLimit?.unit || "A"}
                                  </Button>
                                ))}
                              </div>
                              {commandChargePowerLimit && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Current Limit: {commandChargePowerLimit.value} {commandChargePowerLimit.unit} (Min: {commandChargePowerLimit.min}, Max: {commandChargePowerLimit.max})
                                </p>
                              )}
                            </div>

                            <form onSubmit={handleSetSessionEnergyLimit} className="space-y-2">
                              <Label htmlFor="session-energy-limit">Session Energy Limit ({commandSessionEnergyLimit?.unit || "kWh"})</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="session-energy-limit"
                                  type="number"
                                  value={inputSessionEnergyLimit}
                                  onChange={(e) => setInputSessionEnergyLimit(e.target.value)}
                                  min={commandSessionEnergyLimit?.min || 0.1}
                                  max={commandSessionEnergyLimit?.max || 250}
                                  step="0.1"
                                  placeholder={`e.g., ${commandSessionEnergyLimit?.value ?? '10'}`}
                                  className="flex-grow"
                                  disabled={isLoadingCommandSettings}
                                />
                                <Button type="submit" disabled={isLoadingCommandSettings}>Set Limit</Button>
                              </div>
                              {commandSessionEnergyLimit && (
                                  <p className="text-xs text-muted-foreground">
                                      Current limit: {commandSessionEnergyLimit.value !== null ? `${commandSessionEnergyLimit.value} ${commandSessionEnergyLimit.unit}` : "Not set"}
                                      (Min: {commandSessionEnergyLimit.min}, Max: {commandSessionEnergyLimit.max})
                                  </p>
                              )}
                            </form>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                 <div className="lg:col-span-1"></div>

                </div>
                 <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5"/>Device Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {renderStatusValue("Type", evChargerData?.type, <Construction />)}
                        {renderStatusValue("UUID", evChargerData?.uuid, <Hash />)}
                        {renderStatusValue("Serial Number", evChargerData?.serial_number, <Hash />)}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedules">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>Manage Schedules</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Button onClick={syncSchedulesFromDevice} variant="outline" size="sm" disabled={isSyncingFromDevice || !evChargerData?.uuid || isLoadingDeviceSchedule}>
                                        {isSyncingFromDevice ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <DownloadCloud className="mr-2 h-4 w-4" />}
                                        Update Schedule
                                    </Button>
                                    <Button onClick={() => handleOpenScheduleDialog()} size="sm">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Schedule
                                    </Button>
                                </div>
                            </div>
                            <CardDescription>
                                Create, edit, and manage charging schedules. Click "Activate" to send a schedule to your EV charger.
                                {(isLoadingLocalSchedules || isLoadingDeviceSchedule || isSyncingFromDevice) && <span className="text-xs text-muted-foreground italic block pt-1"> Fetching schedule info...</span>}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {(isLoadingLocalSchedules || isSyncingFromDevice || isLoadingDeviceSchedule) && localSchedules.length === 0 && (
                                <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> Loading schedules...</div>
                            )}
                            {!isLoadingLocalSchedules && !isSyncingFromDevice && localSchedules.length === 0 && (
                                <p className="text-muted-foreground text-center py-4">No saved schedules yet. Click "Add New Schedule" or "Update Schedule" to import from device.</p>
                            )}
                            {!isLoadingLocalSchedules && !isSyncingFromDevice && localSchedules.length > 0 && (
                                <div className="space-y-3">
                                    {localSchedules.map((schedule, index) => {
                                        const isActiveOnDevice = schedule.name === deviceActiveScheduleName;
                                        return (
                                            <Card key={schedule.id} className={`bg-muted/30 ${isActiveOnDevice ? 'border-primary ring-1 ring-primary' : ''}`}>
                                                <CardHeader className="pb-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg flex items-center">
                                                                {schedule.name}
                                                                {isActiveOnDevice && (
                                                                    <Badge variant="default" className="ml-2 bg-green-500 hover:bg-green-600">
                                                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5"/> Active on Device
                                                                    </Badge>
                                                                )}
                                                            </CardTitle>
                                                            <CardDescription className="text-xs">
                                                                Last updated: {format(parseISO(schedule.updatedAt), "PPp")}
                                                            </CardDescription>
                                                        </div>
                                                        <div className="flex items-center space-x-1.5">
                                                            <Button variant="ghost" size="icon" onClick={() => moveScheduleUp(schedule.id)} disabled={index === 0} aria-label="Move schedule up">
                                                              <ArrowUpCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => moveScheduleDown(schedule.id)} disabled={index === localSchedules.length - 1} aria-label="Move schedule down">
                                                              <ArrowDownCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant={isActiveOnDevice ? "secondary" : "default"}
                                                                size="sm"
                                                                onClick={() => handleActivateScheduleOnDevice(schedule)}
                                                                disabled={isLoadingDeviceSchedule || isActiveOnDevice}
                                                            >
                                                                {isLoadingDeviceSchedule && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                                                {isActiveOnDevice ? <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/>Activated</> : <><ZapIcon className="mr-1.5 h-3.5 w-3.5" />Activate</>}
                                                            </Button>
                                                            <Button variant="outline" size="icon" onClick={() => handleOpenScheduleDialog(schedule)}><Edit className="h-4 w-4" /></Button>
                                                            <Button variant="destructive" size="icon" onClick={() => handleDeleteLocalScheduleClick(schedule)}><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="text-sm">
                                                    <p><Clock className="inline mr-1.5 h-4 w-4 text-muted-foreground" /> {formatScheduleRulesForDisplay(schedule.rules)}</p>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                         <CardFooter className="pt-4 border-t">
                            <div className="flex items-center space-x-2">
                                <Button
                                    onClick={() => evChargerData?.uuid && fetchDeviceActiveScheduleInfo(evChargerData.uuid)}
                                    variant="outline"
                                    size="sm"
                                    disabled={isLoadingDeviceSchedule || !evChargerData?.uuid}
                                >
                                    {isLoadingDeviceSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                    Refresh Device Active Status
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader><CardTitle className="text-base">Note on Schedule Management</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Schedules are saved in your browser. Click "Activate" to send one to your GivEnergy EV Charger, making it the active schedule on the device.
                                The "Active on Device" badge shows which schedule from your list matches the name of the charger's current active schedule.
                                "Update Schedule" fetches all schedules from the device, adding new ones to your local list and updating existing local ones if their names match.
                                "Refresh Device Active Status" re-checks which schedule is currently active on the device by name. Editing a locally active schedule will automatically attempt to update it on the device.
                                Deleting a schedule from this list removes it locally but does not delete it from the EV charger's memory.
                            </p>
                        </CardContent>
                    </Card>
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5"/>Charging Session History & Analysis</CardTitle>
                        <CardDescription>Review past charging sessions and visualize energy usage. Filter by date and status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSessionSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-end">
                            <div className="space-y-1">
                                <Label htmlFor="session-start-date">Start Date</Label>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button id="session-start-date" variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formatDateForDisplay(sessionFilterStartDate)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={sessionFilterStartDate} onSelect={setSessionFilterStartDate} initialFocus disabled={(date) => sessionFilterEndDate ? date > sessionFilterEndDate : false}/>
                                </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="session-end-date">End Date</Label>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button id="session-end-date" variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formatDateForDisplay(sessionFilterEndDate)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={sessionFilterEndDate} onSelect={setSessionFilterEndDate} initialFocus disabled={(date) => sessionFilterStartDate ? date < sessionFilterStartDate : false} />
                                </PopoverContent>
                                </Popover>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="status-filter">Status</Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger id="status-filter">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        {uniqueSessionStatuses.map(status => (
                                            <SelectItem key={status} value={status}>{status}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoadingChargingSessions}>
                                {isLoadingChargingSessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListFilter className="mr-2 h-4 w-4" />}
                                Search Sessions
                            </Button>
                        </form>
                        <div className="flex items-center space-x-2 mb-4">
                            <Switch
                                id="hide-na-energy-filter"
                                checked={hideNaEnergy}
                                onCheckedChange={setHideNaEnergy}
                            />
                            <Label htmlFor="hide-na-energy-filter">Hide sessions with N/A energy</Label>
                        </div>

                        {isLoadingChargingSessions && displayedSessions.length === 0 && <div className="text-center py-4"><Loader2 className="animate-spin mx-auto my-4 h-6 w-6" /></div>}
                        {displayedSessions.length > 0 ? (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Start Time</TableHead>
                                            <TableHead>End Time</TableHead>
                                            <TableHead className="text-right">Energy (kWh)</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedSessions.map((session, index) => {
                                            let energyDisplay = "N/A";
                                            if (typeof session.kwh_delivered === 'number') {
                                                energyDisplay = session.kwh_delivered.toFixed(2);
                                            } else if (typeof session.meter_start === 'number' && typeof session.meter_stop === 'number' && session.meter_stop > session.meter_start) {
                                                const energyWh = session.meter_stop - session.meter_start;
                                                 if (energyWh > 0) {
                                                    const energyKWh = energyWh / 1000;
                                                    energyDisplay = energyKWh.toFixed(2);
                                                }
                                            }

                                            return (
                                                <TableRow key={session.id || index}>
                                                    <TableCell>{session.started_at ? format(parseISO(session.started_at), "PPpp") : 'N/A'}</TableCell>
                                                    <TableCell>{session.stopped_at ? format(parseISO(session.stopped_at), "PPpp") : 'Ongoing'}</TableCell>
                                                    <TableCell className="text-right">{energyDisplay}</TableCell>
                                                    <TableCell>{session.stop_reason || (session.stopped_at ? 'Completed' : 'Active')}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                {hasMoreChargingSessions && !isLoadingChargingSessions && (
                                    <div className="mt-4 text-center">
                                        <Button onClick={() => fetchChargingSessions(chargingSessionsPage + 1, true, sessionFilterStartDate, sessionFilterEndDate)} disabled={isLoadingChargingSessions}>
                                            {isLoadingChargingSessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Load More"}
                                        </Button>
                                    </div>
                                )}
                                {isLoadingChargingSessions && displayedSessions.length > 0 && <div className="text-center py-4"><Loader2 className="animate-spin mx-auto my-4 h-6 w-6" /></div>}

                                {!isLoadingChargingSessions && chartSessionData.length > 0 && (
                                  <div className="mt-8 space-y-8">
                                    <div>
                                      <h3 className="text-lg font-semibold mb-2 text-center">Energy Delivered per Session</h3>
                                      <div className="h-[400px] md:h-[450px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={chartSessionData} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis
                                              dataKey="formattedStartTime"
                                              angle={-45}
                                              textAnchor="end"
                                              height={80}
                                              interval={chartSessionData.length > 15 ? 'preserveStartEnd' : 0}
                                              tick={{ fontSize: 12 }}
                                            />
                                            <YAxis
                                              label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft', dy: 40 }}
                                              allowDecimals={true}
                                              tick={{ fontSize: 12 }}
                                            />
                                            <Tooltip
                                              formatter={(value: number, name: string, props: any) => {
                                                const sessionStatus = props.payload.stopReason;
                                                return [`${value.toFixed(2)} kWh (Status: ${sessionStatus})`, "Energy Delivered"];
                                              }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="energyKWh" name="Energy Delivered" fill={theme === 'dark' || theme === 'hc-dark' ? "hsl(var(--primary))" : "hsl(var(--primary))"} radius={[4, 4, 0, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>

                                    {chartSessionData.some(d => d.durationMinutes !== null) && (
                                    <div>
                                      <h3 className="text-lg font-semibold mb-2 text-center">Session Duration</h3>
                                      <div className="h-[400px] md:h-[450px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={chartSessionData.filter(d => d.durationMinutes !== null)} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                             <XAxis
                                              dataKey="formattedStartTime"
                                              angle={-45}
                                              textAnchor="end"
                                              height={80}
                                              interval={chartSessionData.filter(d => d.durationMinutes !== null).length > 15 ? 'preserveStartEnd' : 0}
                                              tick={{ fontSize: 12 }}
                                            />
                                            <YAxis
                                              label={{ value: 'Duration (minutes)', angle: -90, position: 'insideLeft', dy: 50 }}
                                              tick={{ fontSize: 12 }}
                                            />
                                            <Tooltip
                                              formatter={(value: number, name: string, props: any) => {
                                                  const energyVal = props.payload.energyKWh;
                                                  return [`${value} min (Energy: ${energyVal.toFixed(2)} kWh)`, "Duration"];
                                              }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="durationMinutes" name="Session Duration" fill={theme === 'dark' || theme === 'hc-dark' ? "hsl(var(--chart-2))" : "hsl(var(--chart-3))"} radius={[4, 4, 0, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                    </div>
                                    )}

                                    {dailyEnergyChartData.length > 0 && (
                                      <div>
                                        <h3 className="text-lg font-semibold mb-2 text-center">Total Energy Delivered per Day</h3>
                                        <div className="h-[400px] md:h-[450px]">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dailyEnergyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 70 }}>
                                              <CartesianGrid strokeDasharray="3 3" />
                                              <XAxis
                                                dataKey="formattedDate"
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                                interval={dailyEnergyChartData.length > 15 ? 'preserveStartEnd' : 0}
                                                tick={{ fontSize: 12 }}
                                              />
                                              <YAxis
                                                label={{ value: 'Total Energy (kWh)', angle: -90, position: 'insideLeft', dy: 60 }}
                                                allowDecimals={true}
                                                tick={{ fontSize: 12 }}
                                              />
                                              <Tooltip
                                                formatter={(value: number) => [`${value.toFixed(2)} kWh`, "Total Energy"]}
                                              />
                                              <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                              <Bar dataKey="totalEnergyKWh" name="Total Energy per Day" fill={theme === 'dark' || theme === 'hc-dark' ? "hsl(var(--chart-4))" : "hsl(var(--chart-5))"} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                            </>
                        ) : (!isLoadingChargingSessions && <p className="text-center text-muted-foreground py-4">No charging sessions found for the selected criteria.</p>)}
                    </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings">
                 <Card>
                  <CardHeader>
                    <CardTitle>Legacy EV Charger Settings</CardTitle>
                    <CardDescription>
                      Adjust settings related to EV charging. Some of these settings may interact with your inverter.
                      Refer to GivEnergy documentation for details on each setting. These are older register-based settings.
                      Use the 'Overview' tab for newer command-based controls.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoadingCommandSettings ? <Loader2 className="animate-spin"/> : (
                      <>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                          <Label htmlFor="solar-charging-mode" className="flex items-center">
                            <Sun className="mr-2 h-4 w-4" /> Solar Charging Mode
                          </Label>
                          <Switch
                            id="solar-charging-mode"
                            checked={settingsLegacy.solarCharging}
                            onCheckedChange={handleToggleSolarCharging}
                            disabled={!inverterSerial}
                          />
                        </div>
                         <p className="text-xs text-muted-foreground -mt-4 px-3">When Enabled, your EV will automatically charge while plugged in, provided solar generation is exceeds 1.4kW.</p>

                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                          <Label htmlFor="plug-and-charge-mode" className="flex items-center">
                            <PlugZap className="mr-2 h-4 w-4" /> Plug & Charge (Register 616)
                          </Label>
                          <Switch
                            id="plug-and-charge-mode"
                            checked={settingsLegacy.plugAndCharge}
                            onCheckedChange={handleTogglePlugAndCharge}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground -mt-4 px-3">Controls whether charging starts automatically on plug-in. This setting uses the 'set-plug-and-go' command which may affect register 616.</p>

                        <div className="p-3 bg-muted/30 rounded-md">
                          <Label htmlFor="max-battery-discharge-evc">Max Battery Power to EVC (kW)</Label>
                          <Slider
                            id="max-battery-discharge-evc"
                            min={0}
                            max={7}
                            step={0.1}
                            value={[settingsLegacy.maxBatteryDischargeToEvc / 1000]}
                            onValueChange={(value) => setSettingsLegacy((prev: any) => ({...prev, maxBatteryDischargeToEvc: value[0]*1000}))}
                            onValueCommit={ (value) => handleSetMaxBatteryDischargeToEvc([value[0]])}
                            disabled={!inverterSerial}
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Current: {(settingsLegacy.maxBatteryDischargeToEvc / 1000).toFixed(1)} kW (Setting 107). Needs inverter serial.
                          </p>
                        </div>

                        <div className="p-3 bg-muted/30 rounded-md">
                            <Label htmlFor="charge-rate-limit-settings">Charge Rate Limit (Amps - Register 621)</Label>
                            <Slider
                                id="charge-rate-limit-settings"
                                min={6}
                                max={32}
                                step={1}
                                value={[settingsLegacy.chargeRate]}
                                onValueChange={(value) => setSettingsLegacy((prev: any) => ({...prev, chargeRate: value[0]}))}
                                onValueCommit={handleSetChargeRate}
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                                Current: {settingsLegacy.chargeRate} A
                            </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
      <ScheduleDialog
        isOpen={isScheduleDialogOpen}
        onClose={() => {
            setIsScheduleDialogOpen(false);
            setEditingSchedule(null);
        }}
        onSave={handleSaveLocalSchedule}
        existingSchedule={editingSchedule}
        evChargerId={evChargerData?.uuid || "unknown-charger"}
      />
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the schedule
                    "{scheduleToDelete?.name}" from your local list.
                    This action does NOT delete the schedule from the EV charger device itself.
                    If this schedule was active on the device, it may continue to run until another schedule is activated.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setScheduleToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteLocalSchedule}>Delete from Local List</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EVChargerPage;
