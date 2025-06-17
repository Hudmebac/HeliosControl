
'use client';
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, PlugZap, CalendarDays, Power, LineChart, Settings, Loader2, Edit3, ListFilter, History, Info, Construction, FileText, Hash, Wifi, WifiOff, AlertCircle, Sun } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme } from '@/hooks/use-theme';
import { useApiKey } from '@/hooks/use-api-key';
import { useToast } from '@/hooks/use-toast';
import { mapEVChargerAPIStatus } from '@/lib/givenergy';
import { format, parseISO } from 'date-fns';

const EVChargerPage = () => {
  const [evChargerData, setEvChargerData] = useState<any>(null);
  const [isLoadingEvData, setIsLoadingEvData] = useState(true);
  const { apiKey, isLoadingApiKey, inverterSerial, evChargerId: storedEvChargerId } = useApiKey();
  const { toast } = useToast();

  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [settingsLegacy, setSettingsLegacy] = useState<any>({
    solarCharging: false,
    plugAndCharge: false,
    maxBatteryDischargeToEvc: 0,
    chargeRate: 6,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const { theme } = useTheme();

  const [commandChargePowerLimit, setCommandChargePowerLimit] = useState<{ value: number; unit: string; min: number; max: number; } | null>(null);
  const [commandPlugAndGoEnabled, setCommandPlugAndGoEnabled] = useState<boolean | null>(null);
  const [commandSessionEnergyLimit, setCommandSessionEnergyLimit] = useState<{ value: number | null; unit: string; min: number; max: number; } | null>(null);
  const [isLoadingCommandSettings, setIsLoadingCommandSettings] = useState(true);
  const [inputSessionEnergyLimit, setInputSessionEnergyLimit] = useState<string>("");

  const [chargingSessionsData, setChargingSessionsData] = useState<any[]>([]);
  const [isLoadingChargingSessions, setIsLoadingChargingSessions] = useState(false);
  const [chargingSessionsPage, setChargingSessionsPage] = useState(1);
  const [hasMoreChargingSessions, setHasMoreChargingSessions] = useState(true);
  const [sessionStartDate, setSessionStartDate] = useState('');
  const [sessionEndDate, setSessionEndDate] = useState('');

  const chargePowerLimitPresets = [6, 8.5, 10, 12, 16, 24, 32];


  const getAuthHeaders = useCallback(() => {
    if (!apiKey) return {};
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }, [apiKey]);

  const handleApiError = async (response: Response, operationName: string) => {
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
  };

  const fetchLegacySettings = useCallback(async (chargerUuid: string | null) => {
    if (!apiKey || !chargerUuid) return;
    try {
      const headers = getAuthHeaders();
      const plugAndChargeResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/read/616`, { headers });
      const plugAndChargeData = await plugAndChargeResponse.json();
      const plugAndChargeEnabled = plugAndChargeData?.data?.value === 1;

      const chargeRateResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/read/621`, { headers });
      const chargeRateData = await chargeRateResponse.json();
      const chargeRateLimit = chargeRateData?.data?.value;

      const batteryDischargeResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/read/622`, { headers });
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
  }, [apiKey, getAuthHeaders]);

  const fetchSchedules = useCallback(async (chargerUuid: string | null) => {
    if (!apiKey || !chargerUuid) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/commands/set-schedule`, { headers });
      if (!response.ok) {
        await handleApiError(response, 'fetching schedules');
        setSchedules([]);
        return;
      }
      const data = await response.json();
      if (data && data.data) {
        if (Array.isArray(data.data)) {
          setSchedules(data.data);
        } else if (typeof data.data === 'object' && data.data !== null) {
          setSchedules([data.data]);
        } else {
          setSchedules([]);
        }
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setSchedules([]);
      toast({variant: "destructive", title: "Fetch Schedules Error", description: "Could not load EV charging schedules."});
    }
  }, [apiKey, getAuthHeaders, toast]);

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
  }, [apiKey, getAuthHeaders, toast]);

  const fetchCurrentPlugAndGo = useCallback(async (chargerUuid: string) => {
    if (!apiKey || !chargerUuid) return;
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/commands/set-plug-and-go`, { headers });
      if (!response.ok) {
        await handleApiError(response, 'fetching plug and go status');
        setCommandPlugAndGoEnabled(null);
        return;
      }
      const data = await response.json();
      if (data && typeof data.data === 'boolean') {
        setCommandPlugAndGoEnabled(data.data);
      } else {
        if (data && data.data && typeof data.data.enabled === 'boolean') {
          setCommandPlugAndGoEnabled(data.data.enabled);
        } else {
          console.warn('Unexpected response structure for GET set-plug-and-go:', data);
          setCommandPlugAndGoEnabled(null);
        }
      }
    } catch (error) {
      console.error('Error fetching plug and go status:', error);
      setCommandPlugAndGoEnabled(null);
    }
  }, [apiKey, getAuthHeaders, toast]);

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
  }, [apiKey, getAuthHeaders, toast]);

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
        const specificChargerResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}`, { headers });
        if (!specificChargerResponse.ok) {
          await handleApiError(specificChargerResponse, `fetching EV charger ${chargerUuid}`);
          setEvChargerData(null);
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
            if (meterData && meterData.data && meterData.data.length > 0) {
              const latestMeterReading = meterData.data[0];
              const powerMeasurand = latestMeterReading.readings.find((reading: any) => reading.measurand_id === 13);
              if (powerMeasurand) {
                currentPower = powerMeasurand.value;
              }
              setEvChargerData((prevData: any) => ({ ...prevData, current_power: currentPower }));
            }
          }

          const historicalMeterResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/meter-data?page=1&pageSize=50`, { headers });
          if (!historicalMeterResponse.ok) {
            console.warn(`Failed to fetch historical meter data for EV charger ${chargerUuid}. Status: ${historicalMeterResponse.status}`);
          } else {
            const historicalMeterData = await historicalMeterResponse.json();
            if (historicalMeterData && historicalMeterData.data) {
              const formattedData = historicalMeterData.data.slice().reverse().map((reading: any) => {
                const powerMeasurand = reading.readings.find((r: any) => r.measurand_id === 13);
                return {
                  time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  power: powerMeasurand ? powerMeasurand.value : 0,
                };
              }).reverse();
              setChartData(formattedData);
              setAnalyticsData(historicalMeterData.data);
            }
          }
        } else {
          setEvChargerData(null);
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
      setEvChargerData(null);
    } finally {
      if (!isSoftRefresh) {
        setIsLoadingEvData(false);
      }
    }
  }, [apiKey, storedEvChargerId, getAuthHeaders, toast]);

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
        fetchSchedules(evChargerData.uuid),
        fetchCurrentChargePowerLimit(evChargerData.uuid),
        fetchCurrentPlugAndGo(evChargerData.uuid),
        fetchCurrentSessionEnergyLimit(evChargerData.uuid)
      ]).finally(() => {
        setIsLoadingCommandSettings(false);
      });
    }
  }, [evChargerData?.uuid, apiKey, fetchLegacySettings, fetchSchedules, fetchCurrentChargePowerLimit, fetchCurrentPlugAndGo, fetchCurrentSessionEnergyLimit]);


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
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/adjust-charge-power-limit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ limit: newLimit }),
      });
      if (!response.ok) {
        await handleApiError(response, 'adjusting charge power limit');
        return;
      }
      const data = await response.json();
      if (data?.data?.success) {
        toast({ title: "Charge Power Limit Updated", description: data.data.message || "Command accepted." });
        fetchCurrentChargePowerLimit(evChargerData.uuid);
      } else {
        toast({ variant: "destructive", title: "Update Not Confirmed", description: data?.data?.message || "Failed to update charge power limit." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Command Error", description: "Failed to set charge power limit." });
    }
  };

  const handleCommandSetPlugAndGo = async (enabled: boolean) => {
    if (!apiKey || !evChargerData?.uuid) return;
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/set-plug-and-go`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled: enabled }),
      });
      if (!response.ok) {
        await handleApiError(response, 'setting plug and go');
        return;
      }
      const data = await response.json();
      if (data?.data?.success) {
        toast({ title: "Plug and Go Updated", description: data.data.message || "Command accepted." });
        fetchCurrentPlugAndGo(evChargerData.uuid);
      } else {
        toast({ variant: "destructive", title: "Update Not Confirmed", description: data?.data?.message || "Failed to update plug and go." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Command Error", description: "Failed to set plug and go." });
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
      fetchEvChargerData(true);
      toast({title: "Solar Charging Setting Updated"});
    } catch (error) {
      toast({ variant: "destructive", title: "Solar Charging Error", description: "An unexpected error occurred." });
    }
  };

  const handleTogglePlugAndCharge = async (checked: boolean) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setSettingsLegacy((prevSettings: any) => ({ ...prevSettings, plugAndCharge: checked }));
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/settings/616/write`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: checked ? 1 : 0 }),
      });
      if (!response.ok) {
         await handleApiError(response, 'toggling plug and charge (settings)');
        return;
      }
      fetchEvChargerData(true);
      toast({title: "Plug & Charge Setting (Register) Updated"});
    } catch (error) {
      toast({ variant: "destructive", title: "Plug & Charge Error", description: "An unexpected error occurred." });
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
      fetchEvChargerData(true);
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
      fetchEvChargerData(true);
      toast({title: "Charge Rate Limit (Register) Updated"});
    } catch (error) {
      toast({ variant: "destructive", title: "Charge Rate Error", description: "An unexpected error occurred." });
    }
  }, [apiKey, evChargerData?.uuid, getAuthHeaders, toast, fetchEvChargerData]);

  const handleAddSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiKey || !evChargerData?.uuid) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const scheduleName = formData.get('scheduleName') as string;
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;
    const daysSelected = Array.from(formData.getAll('days')) as string[];

    const payload = {
      name: scheduleName || "Unnamed Schedule",
      active: true,
      rules: [ { start_time: startTime, end_time: endTime, days: daysSelected.join(','), } ]
    };

    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/set-schedule`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        await handleApiError(response, 'adding/updating schedule');
        return;
      }
      const data = await response.json();
      if (data && data.data && data.data.success) {
        toast({ title: "Schedule Updated", description: data.data.message || "Schedule command accepted." });
        fetchSchedules(evChargerData.uuid);
      } else {
        toast({ variant: "destructive", title: "Schedule Update Not Confirmed", description: data?.data?.message || data?.error || "Command sent, but success not confirmed." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Schedule Error", description: "Could not update schedule." });
    }
  };

  const fetchChargingSessions = useCallback(async (page = 1, append = false, startDate?: string, endDate?: string) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setIsLoadingChargingSessions(true);
    try {
      const headers = getAuthHeaders();
      let url = `/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/charging-sessions?page=${page}&pageSize=10`;
      if (startDate) {
          const [dd, mm, yyyy] = startDate.split('/');
          url += `&start_time=${yyyy}-${mm}-${dd}T00:00:00Z`;
      }
      if (endDate) {
           const [dd, mm, yyyy] = endDate.split('/');
          url += `&end_time=${yyyy}-${mm}-${dd}T23:59:59Z`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        await handleApiError(response, 'fetching charging sessions');
        setChargingSessionsData([]);
        setHasMoreChargingSessions(false);
        return;
      }
      const result = await response.json();
      if (result && result.data) {
        const sortedData = result.data.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        setChargingSessionsData(prev => append ? [...prev, ...sortedData] : sortedData);
        setChargingSessionsPage(page);
        setHasMoreChargingSessions(result.data.length > 0 && result.meta && result.meta.current_page < result.meta.last_page);
      } else {
        setChargingSessionsData(append ? chargingSessionsData : []);
        setHasMoreChargingSessions(false);
      }
    } catch (error) {
      console.error('Error fetching charging sessions:', error);
      setChargingSessionsData(append ? chargingSessionsData : []);
      setHasMoreChargingSessions(false);
      toast({ variant: "destructive", title: "Fetch Sessions Error", description: "Could not load charging sessions." });
    } finally {
      setIsLoadingChargingSessions(false);
    }
  }, [apiKey, evChargerData?.uuid, getAuthHeaders, toast, chargingSessionsData]);

  const handleSessionSearch = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      fetchChargingSessions(1, false, sessionStartDate, sessionEndDate);
  };

  useEffect(() => {
    if (evChargerData?.uuid && apiKey) {
        fetchChargingSessions(1, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evChargerData?.uuid, apiKey]);

  const renderStatusValue = (label: string, value: any, icon?: React.ReactNode, unit?: string) => {
    const displayValue = value !== null && value !== undefined ? String(value) : "N/A";
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0">
        <div className="flex items-center">
          {icon && React.cloneElement(icon as React.ReactElement, { className: "mr-2 h-4 w-4 text-muted-foreground" })}
          <span className="text-sm text-muted-foreground">{label}:</span>
        </div>
        <span className="text-sm font-medium text-foreground">
          {displayValue} {unit && displayValue !== "N/A" ? unit : ""}
        </span>
      </div>
    );
  };

  if (isLoadingApiKey || isLoadingEvData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading EV Charger Details...</p>
      </div>
    );
  }

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
                  {/* Left Column: Instant Control */}
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center"><Power className="mr-2 h-5 w-5"/>Instant Control</CardTitle>
                        <CardDescription>Real-time commands for your EV charger.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {isLoadingCommandSettings ? (
                          <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="ml-2">Loading controls...</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col sm:flex-row gap-4">
                              <Button onClick={handleStartCharge} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Start Charging</Button>
                              <Button onClick={handleStopCharge} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Stop Charging</Button>
                            </div>

                            <div>
                              <Label htmlFor="charge-power-limit-buttons" className="mb-2 block">Charge Power Limit ({commandChargePowerLimit?.unit || "A"})</Label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {chargePowerLimitPresets.map(limit => (
                                  <Button
                                    key={limit}
                                    variant={commandChargePowerLimit?.value === limit ? "default" : "outline"}
                                    onClick={() => handleAdjustChargePowerLimit(limit)}
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

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="plug-and-go-mode"
                                checked={commandPlugAndGoEnabled ?? false}
                                onCheckedChange={handleCommandSetPlugAndGo}
                              />
                              <Label htmlFor="plug-and-go-mode">Plug and Go Mode ({commandPlugAndGoEnabled ? "Enabled" : "Disabled"})</Label>
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
                                />
                                <Button type="submit">Set Limit</Button>
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

                  {/* Right Column: Charger Status */}
                  <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center"><Info className="mr-2 h-5 w-5"/>Charger Status</CardTitle>
                            <CardDescription>Current status of your EV charger.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1">
                           {renderStatusValue("Alias", evChargerData?.alias, <FileText />)}
                           {renderStatusValue("Online", evChargerData?.online, evChargerData?.online ? <Wifi color="green"/> : <WifiOff color="red"/> )}
                           {renderStatusValue("Status", mapEVChargerAPIStatus(evChargerData?.status), <AlertCircle />)}
                           {renderStatusValue("Current Power", evChargerData?.current_power, <Power/>, "W")}
                           {renderStatusValue("Last Offline", evChargerData?.went_offline_at ? format(parseISO(evChargerData.went_offline_at), "PPpp") : 'N/A', <CalendarDays />)}
                        </CardContent>
                    </Card>
                  </div>
                </div>
                 {/* Device Information Card (full width below columns) */}
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
                <Card>
                  <CardHeader>
                    <CardTitle>Charging Schedules</CardTitle>
                    <CardDescription>Manage your EV charging schedules.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingCommandSettings ? <Loader2 className="animate-spin" /> : (
                      schedules.length > 0 ? (
                        <ul className="space-y-2">
                          {schedules.map((schedule, index) => (
                            <li key={index} className="p-2 border rounded-md">
                              <p className="font-semibold">{schedule.name || `Schedule ${index + 1}`}</p>
                              {schedule.rules?.map((rule: any, ruleIndex: number) => (
                                <p key={ruleIndex} className="text-sm text-muted-foreground">
                                  {rule.start_time} - {rule.end_time} on {rule.days} ({schedule.active ? 'Active' : 'Inactive'})
                                </p>
                              ))}
                            </li>
                          ))}
                        </ul>
                      ) : <p>No schedules found or API does not return current schedules via GET.</p>
                    )}
                    <form onSubmit={handleAddSchedule} className="mt-4 space-y-4">
                      <Input name="scheduleName" placeholder="Schedule Name (Optional)" />
                      <div className="grid grid-cols-2 gap-4">
                        <Input name="startTime" type="time" required />
                        <Input name="endTime" type="time" required />
                      </div>
                      <div className="space-y-1">
                        <Label>Days:</Label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="flex items-center">
                              <input type="checkbox" name="days" value={day} id={`day-${day}`} className="mr-2"/>
                              <Label htmlFor={`day-${day}`}>{day}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button type="submit">Add/Update Schedule</Button>
                       <p className="text-xs text-muted-foreground">Note: GivEnergy's current API for `set-schedule` may overwrite existing schedules or create new ones. This form attempts to set a single schedule rule. Refer to official GivEnergy documentation for detailed behavior.</p>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics">
                <Card>
                  <CardHeader>
                    <CardTitle>Power Analytics</CardTitle>
                    <CardDescription>Historical EV charging power usage.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px]">
                    {isLoadingEvData && chartData.length === 0 ? <Loader2 className="animate-spin"/> :
                     chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <XAxis dataKey="time" />
                          <YAxis label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="power" stroke={theme === 'dark' || theme === 'hc-dark' ? "#FFA500" : "#000000"} fill={theme === 'dark' || theme === 'hc-dark' ? "#FFA500" : "#000000"} fillOpacity={0.3} name="Charging Power" unit="W" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <p>No historical power data available for charting.</p>}
                  </CardContent>
                </Card>
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5"/>Charging Session History</CardTitle>
                        <CardDescription>Review past charging sessions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSessionSearch} className="flex flex-col sm:flex-row gap-2 mb-4">
                            <Input type="text" value={sessionStartDate} onChange={(e) => setSessionStartDate(e.target.value)} placeholder="Start Date (DD/MM/YYYY)" className="flex-1"/>
                            <Input type="text" value={sessionEndDate} onChange={(e) => setSessionEndDate(e.target.value)} placeholder="End Date (DD/MM/YYYY)" className="flex-1"/>
                            <Button type="submit" className="flex-shrink-0">
                                <ListFilter className="mr-2 h-4 w-4" /> Search
                            </Button>
                        </form>
                        {isLoadingChargingSessions && chargingSessionsData.length === 0 && <Loader2 className="animate-spin mx-auto my-4" />}
                        {chargingSessionsData.length > 0 ? (
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
                                        {chargingSessionsData.map((session, index) => (
                                            <TableRow key={session.id || index}>
                                                <TableCell>{format(new Date(session.started_at), "PPpp")}</TableCell>
                                                <TableCell>{session.finished_at ? format(new Date(session.finished_at), "PPpp") : 'Ongoing'}</TableCell>
                                                <TableCell className="text-right">{session.kwh_delivered?.toFixed(2) ?? 'N/A'}</TableCell>
                                                <TableCell>{session.status || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {hasMoreChargingSessions && !isLoadingChargingSessions && (
                                    <div className="mt-4 text-center">
                                        <Button onClick={() => fetchChargingSessions(chargingSessionsPage + 1, true, sessionStartDate, sessionEndDate)}>
                                            Load More
                                        </Button>
                                    </div>
                                )}
                                {isLoadingChargingSessions && chargingSessionsData.length > 0 && <Loader2 className="animate-spin mx-auto my-4" />}
                            </>
                        ) : (!isLoadingChargingSessions && <p>No charging sessions found for the selected criteria.</p>)}
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
                         <p className="text-xs text-muted-foreground -mt-4 px-3">Enables/disables charging from excess solar (Setting 106). Needs inverter serial.</p>

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
                        <p className="text-xs text-muted-foreground -mt-4 px-3">Controls whether charging starts automatically on plug-in via register 616.</p>

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
    </>
  );
};

export default EVChargerPage;
