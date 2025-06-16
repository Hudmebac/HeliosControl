
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sun, Moon, Contrast, ArrowLeft, PlugZap, CalendarDays, Power, LineChart, Settings, Loader2, Edit3, ListFilter, History } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTheme, themes } from '@/hooks/use-theme';
import { useApiKey } from '@/hooks/use-api-key';
import { useToast } from '@/hooks/use-toast';


const EVChargerPage = () => {
  const [evChargerData, setEvChargerData] = useState<any>(null);
  const [isLoadingEvData, setIsLoadingEvData] = useState(true);
  const { apiKey, isLoadingApiKey, inverterSerial, evChargerId: storedEvChargerId } = useApiKey();
  const { toast } = useToast();

  const evChargerStatusMap: { [key: string]: string } = {
    Available: 'Available',
    Preparing: 'Preparing to Charge',
    Charging: 'Charging',
    SuspendedEVSE: 'Charging Suspended (EVSE Side)',
    SuspendedEV: 'Charging Suspended (EV Side)',
    Finishing: 'Finishing Charge',
    Reserved: 'Reserved',
    Faulted: 'Faulted',
    Unavailable: 'Unavailable',
    Unknown: 'Unknown',
  };
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    solarCharging: false,
    plugAndCharge: false,
    maxBatteryDischargeToEvc: 0,
    chargeRate: 6,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const { theme } = useTheme();

  // State for Instant Control command-based settings
  const [commandChargePowerLimit, setCommandChargePowerLimit] = useState<{ value: number; unit: string; min: number; max: number; } | null>(null);
  const [commandPlugAndGoEnabled, setCommandPlugAndGoEnabled] = useState<boolean | null>(null);
  const [commandSessionEnergyLimit, setCommandSessionEnergyLimit] = useState<{ value: number | null; unit: string; min: number; max: number; } | null>(null);
  const [isLoadingCommandSettings, setIsLoadingCommandSettings] = useState(true);
  const [inputSessionEnergyLimit, setInputSessionEnergyLimit] = useState<string>("");

  // State for Charging Sessions
  const [chargingSessionsData, setChargingSessionsData] = useState<any[]>([]);
  const [isLoadingChargingSessions, setIsLoadingChargingSessions] = useState(false);
  const [chargingSessionsPage, setChargingSessionsPage] = useState(1);
  const [hasMoreChargingSessions, setHasMoreChargingSessions] = useState(true);

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

  const fetchSettings = useCallback(async (chargerUuid: string | null) => {
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

      setSettings(prevSettings => ({
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
          // If API returns a single schedule object instead of array for GET (as per some GivEnergy patterns)
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

  // Fetch functions for new command-based settings
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
      // The API doc says command data is just `true` or `false` for set-plug-and-go GET
      if (data && typeof data.data === 'boolean') {
        setCommandPlugAndGoEnabled(data.data);
      } else {
        // If it's wrapped in an object like {"enabled": true}
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
      const chargerListData = await chargerResponse.json();

      let chargerUuid = null;
      if (chargerListData && chargerListData.data && chargerListData.data.length > 0 && chargerListData.data[0].uuid) {
        chargerUuid = chargerListData.data[0].uuid;
      } else if (storedEvChargerId) {
        chargerUuid = storedEvChargerId;
      }

      if (chargerUuid) {
        const specificChargerResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}`, { headers });
        const specificChargerData = await specificChargerResponse.json();

        if (specificChargerData && specificChargerData.data) {
          const chargerDetails = specificChargerData.data;
          setEvChargerData(prevData => ({
            ...prevData,
            uuid: chargerDetails.uuid,
            online: chargerDetails.online,
            status: chargerDetails.status,
            type: chargerDetails.type,
            serial_number: chargerDetails.serial_number,
            went_offline_at: chargerDetails.went_offline_at
          }));

          const meterResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/meter-data`, { headers });
          const meterData = await meterResponse.json();
          let currentPower = null;
          if (meterData && meterData.data && meterData.data.length > 0) {
            const latestMeterReading = meterData.data[0];
            const powerMeasurand = latestMeterReading.readings.find((reading: any) => reading.measurand_id === 13);
            if (powerMeasurand) {
              currentPower = powerMeasurand.value;
            }
            setEvChargerData(prevData => ({ ...prevData, current_power: currentPower }));
          }

          const historicalMeterResponse = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/meter-data?page=1&pageSize=50`, { headers });
          const historicalMeterData = await historicalMeterResponse.json();
          if (historicalMeterData && historicalMeterData.data) {
            const formattedData = historicalMeterData.data.map((reading: any) => {
              const powerMeasurand = reading.readings.find((r: any) => r.measurand_id === 13);
              return {
                time: new Date(reading.timestamp).toLocaleTimeString(),
                power: powerMeasurand ? powerMeasurand.value : 0,
              };
            }).reverse();
            setChartData(formattedData);
            setAnalyticsData(historicalMeterData.data);
          }
        } else {
          setEvChargerData(null);
        }
      } else {
        setEvChargerData(null);
      }
    } catch (error) {
      console.error('Error fetching EV charger data:', error);
      setEvChargerData(null);
    } finally {
      if (!isSoftRefresh) {
        setIsLoadingEvData(false);
      }
    }
  }, [apiKey, storedEvChargerId, getAuthHeaders]);

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
        fetchSettings(evChargerData.uuid),
        fetchSchedules(evChargerData.uuid),
        fetchCurrentChargePowerLimit(evChargerData.uuid),
        fetchCurrentPlugAndGo(evChargerData.uuid),
        fetchCurrentSessionEnergyLimit(evChargerData.uuid)
      ]).finally(() => {
        setIsLoadingCommandSettings(false);
      });
    }
  }, [evChargerData?.uuid, apiKey, fetchSettings, fetchSchedules, fetchCurrentChargePowerLimit, fetchCurrentPlugAndGo, fetchCurrentSessionEnergyLimit]);


  const handleStartCharge = async () => {
    if (!apiKey || !evChargerData?.uuid) return;
    console.log("Starting charge...");
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/start-charge`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      console.log("Start charge response:", response);
      if (!response.ok) {
        await handleApiError(response, 'starting charge');
        return;
      }
      const data = await response.json();
      console.log("Start charge data:", data);
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
    console.log("Stopping charge...");
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/commands/stop-charge`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      console.log("Stop charge response:", response);
      if (!response.ok) {
        await handleApiError(response, 'stopping charge');
        return;
      }
      const data = await response.json();
      console.log("Stop charge data:", data);
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

  // New handlers for Instant Control tab
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
        fetchCurrentChargePowerLimit(evChargerData.uuid); // Refresh current value
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
        fetchCurrentPlugAndGo(evChargerData.uuid); // Refresh current value
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
        fetchCurrentSessionEnergyLimit(evChargerData.uuid); // Refresh current value
      } else {
        toast({ variant: "destructive", title: "Update Not Confirmed", description: data?.data?.message || "Failed to update session energy limit." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Command Error", description: "Failed to set session energy limit." });
    }
  };


  // Settings handlers (legacy, using direct register writes)
  const handleToggleSolarCharging = async (checked: boolean) => {
    if (!apiKey || !inverterSerial) return;
    setSettings(prevSettings => ({ ...prevSettings, solarCharging: checked }));
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
    setSettings(prevSettings => ({ ...prevSettings, plugAndCharge: checked }));
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
    setSettings(prevSettings => ({ ...prevSettings, maxBatteryDischargeToEvc: value[0] }));
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
    setSettings(prevSettings => ({ ...prevSettings, chargeRate: value[0] }));
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
      name: scheduleName || "Unnamed Schedule", // API might require a name
      active: true, // Assume new schedules are active, or provide a checkbox
      rules: [ { start_time: startTime, end_time: endTime, days: daysSelected.join(','), } ]
      // Note: GivEnergy API for schedules might be more complex, e.g. supporting multiple rules per schedule,
      // or specific format for days (Mon,Tue,Wed or bitmask). This is a basic interpretation.
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

  // Charging Sessions for Analytics Tab
  const fetchChargingSessions = useCallback(async (page = 1, append = false) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setIsLoadingChargingSessions(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/charging-sessions?page=${page}&pageSize=10`, { headers });
      if (!response.ok) {
        await handleApiError(response, 'fetching charging sessions');
        setChargingSessionsData([]);
        setHasMoreChargingSessions(false);
        return;
      }
      const result = await response.json();
      if (result && result.data) {
        setChargingSessionsData(prev => append ? [...prev, ...result.data] : result.data);
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

  useEffect(() => {
    if (evChargerData?.uuid && apiKey) {
        fetchChargingSessions(1, false); // Fetch initial page
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evChargerData?.uuid, apiKey]); // Only re-run if these change, not fetchChargingSessions itself


  if (isLoadingApiKey || isLoadingEvData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading EV Charger Details...</p>
      </div>
    );
  }

  return (
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

      {!apiKey ? (
         <Card>
          <CardHeader><CardTitle>API Key Required</CardTitle></CardHeader>
          <CardContent><p>Please set your GivEnergy API key in the main application settings to use EV Charger features.</p></CardContent>
         </Card>
      ) : !evChargerData?.uuid ? (
        <Card>
          <CardHeader><CardTitle>EV Charger Not Found</CardTitle></CardHeader>
          <CardContent><p>No EV Charger ID found. Ensure your EV charger is registered with your GivEnergy account and the API key has permissions.</p></CardContent>
        </Card>
      ) : (
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
           <TabsTrigger value="overview">Overview</TabsTrigger>
           <TabsTrigger value="instant-control">Instant Control</TabsTrigger>
           <TabsTrigger value="schedule">Schedule</TabsTrigger>
           <TabsTrigger value="analytics">Analytics</TabsTrigger>
           <TabsTrigger value="settings">Settings (Legacy)</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-primary">Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evChargerData ? (
                <>
                  <div className="flex items-center"><PlugZap className="mr-2 h-5 w-5 text-primary" />Charger Online: {evChargerData?.online ? 'Yes' : 'No'}</div>
                  <div className="flex items-center"><Power className="mr-2 h-5 w-5 text-primary" />Current Power: {evChargerData?.current_power ? `${evChargerData.current_power} kW` : 'N/A'}</div>
                  <div className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary" />Status: {evChargerStatusMap[evChargerData?.status || 'Unknown']}</div>
                  <div className="flex items-center"><History className="mr-2 h-5 w-5 text-primary" />Last Offline: {evChargerData?.went_offline_at ? new Date(evChargerData.went_offline_at).toLocaleString() : 'N/A'}</div>
                  <div>Type: {evChargerData?.type || 'N/A'}</div>
                  <div>Serial: {evChargerData?.serial_number || 'N/A'}</div>
                  <div>UUID: {evChargerData?.uuid || 'N/A'}</div>
                </>
              ) : (
                <p>No EV charger data found or could not be loaded. Please check your API key and charger connection.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="instant-control">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-primary">Instant Control</CardTitle>
              <CardDescription>Directly control your EV Charger. Changes are immediate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex space-x-4">
                <Button onClick={handleStartCharge} disabled={!apiKey || !evChargerData?.uuid || isLoadingCommandSettings}>Start Charging</Button>
                <Button onClick={handleStopCharge} variant="destructive" disabled={!apiKey || !evChargerData?.uuid || isLoadingCommandSettings}>Stop Charging</Button>
              </div>
              {isLoadingCommandSettings ? (
                 <div className="flex items-center space-x-2"><Loader2 className="h-5 w-5 animate-spin" /> <p>Loading current control settings...</p></div>
              ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="charge-power-limit-presets">Charge Power Limit ({commandChargePowerLimit?.unit || 'A'}): {commandChargePowerLimit?.value ?? 12}</Label>
                  <div className="flex flex-wrap gap-2 mt-1" id="charge-power-limit-presets">
                    {chargePowerLimitPresets.map((limit) => (
                      <Button
                        key={limit}
                        variant={commandChargePowerLimit?.value === limit ? "default" : (commandChargePowerLimit === null && limit === 12 ? "default" : "outline")}
                        onClick={() => handleAdjustChargePowerLimit(limit)}
                        disabled={!commandChargePowerLimit && limit !==12}
                        className="min-w-[60px]"
                      >
                        {limit}{commandChargePowerLimit?.unit || 'A'}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Current limit: {commandChargePowerLimit?.value ?? 12} {commandChargePowerLimit?.unit || 'A'}</p>
                  <p className="text-xs text-muted-foreground">Min: {commandChargePowerLimit?.min || "N/A"} {commandChargePowerLimit?.unit || 'A'}, Max: {commandChargePowerLimit?.max || "N/A"} {commandChargePowerLimit?.unit || 'A'}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="plug-and-go-switch"
                    checked={commandPlugAndGoEnabled === true}
                    onCheckedChange={handleCommandSetPlugAndGo}
                    disabled={commandPlugAndGoEnabled === null}
                  />
                  <Label htmlFor="plug-and-go-switch">Plug and Go Mode (Current: {commandPlugAndGoEnabled === null ? 'N/A' : commandPlugAndGoEnabled ? 'Enabled' : 'Disabled'})</Label>
                </div>

                <form onSubmit={handleSetSessionEnergyLimit} className="space-y-2">
                  <Label htmlFor="session-energy-limit-input">Session Energy Limit (kWh): {commandSessionEnergyLimit?.value || 'Not Set'}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="session-energy-limit-input"
                      type="number"
                      value={inputSessionEnergyLimit}
                      onChange={(e) => setInputSessionEnergyLimit(e.target.value)}
                      min={commandSessionEnergyLimit?.min || 0.1}
                      max={commandSessionEnergyLimit?.max || 250}
                      step="0.1"
                      placeholder={`e.g. ${commandSessionEnergyLimit?.value || '20 (0.1-250)'}`}
                      disabled={!commandSessionEnergyLimit}
                    />
                    <Button type="submit" disabled={!commandSessionEnergyLimit}>Set Limit</Button>
                  </div>
                   <p className="text-xs text-muted-foreground">Current limit: {commandSessionEnergyLimit?.value !== null ? `${commandSessionEnergyLimit?.value} ${commandSessionEnergyLimit?.unit}` : "Not Set"}</p>
                </form>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="schedule">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-primary">Schedule Management</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold mb-4">Current Schedules / Settings</h3>
              {schedules.length > 0 ? (
                <ul>
                  {schedules.map((schedule: any, index: number) => (
                    <li key={schedule.id || index} className="mb-2 p-2 border rounded">
                      <div>Name: {schedule.name || 'N/A'}</div>
                      <div>Active: {schedule.active !== undefined ? String(schedule.active) : 'N/A'}</div>
                      {schedule.rules && schedule.rules.map((rule: any, ruleIndex: number) => (
                        <div key={ruleIndex} className="ml-4 mt-1">
                          Rule {ruleIndex + 1}: {rule.start_time} - {rule.end_time} on {rule.days}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No schedules found or could not be loaded. You can add a new schedule below.</p>
              )}

              <h3 className="text-xl font-semibold mt-6 mb-4">Add / Update Schedule</h3>
              <form onSubmit={handleAddSchedule} className="space-y-4">
                <div>
                  <Label htmlFor="scheduleName">Schedule Name (Optional)</Label>
                  <Input type="text" id="scheduleName" name="scheduleName" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input type="time" id="startTime" name="startTime" required />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input type="time" id="endTime" name="endTime" required />
                  </div>
                </div>
                <div>
                  <Label className="block mb-2">Days of Week (select at least one)</Label>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <Label key={day} className="inline-flex items-center mr-4">
                      <input type="checkbox" className="form-checkbox" name="days" value={day} />
                      <span className="ml-2">{day}</span>
                    </Label>
                  ))}
                </div>
                <Button type="submit" disabled={!apiKey}>Add / Update Schedule</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-primary">Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold mb-4">Historical Charging Power</h3>
              <div style={{ width: '100%', height: 300 }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <XAxis dataKey="time" stroke={themes[theme as keyof typeof themes]?.text} />
                      <YAxis stroke={themes[theme as keyof typeof themes]?.text} />
                      <Tooltip contentStyle={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, borderColor: themes[theme as keyof typeof themes]?.primary, color: themes[theme as keyof typeof themes]?.text }} />
                      <Area type="monotone" dataKey="power" stroke={themes[theme as keyof typeof themes]?.primary} fill={themes[theme as keyof typeof themes]?.primary} fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (<p>No historical power data available for charting.</p>)}
              </div>
              
              <h3 className="text-xl font-semibold mt-6 mb-4">Charging Sessions</h3>
              {isLoadingChargingSessions && chargingSessionsData.length === 0 ? (
                <div className="flex items-center space-x-2"><Loader2 className="h-5 w-5 animate-spin" /> <p>Loading charging sessions...</p></div>
              ) : chargingSessionsData.length > 0 ? (
                <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Started At</TableHead>
                        <TableHead>Started By</TableHead>
                        <TableHead>Meter Start (kWh)</TableHead>
                        <TableHead>Stopped At</TableHead>
                        <TableHead>Stopped By</TableHead>
                        <TableHead>Meter Stop (kWh)</TableHead>
                        <TableHead>Energy (kWh)</TableHead>
                        <TableHead>Stop Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chargingSessionsData.map((session, index) => (
                        <TableRow key={session.id || index}>
                          <TableCell>{session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}</TableCell>
                          <TableCell>{session.started_by || 'N/A'}</TableCell>
                          <TableCell>{session.meter_start?.toFixed(2) || 'N/A'}</TableCell>
                          <TableCell>{session.stopped_at ? new Date(session.stopped_at).toLocaleString() : 'Active'}</TableCell>
                          <TableCell>{session.stopped_by || 'N/A'}</TableCell>
                          <TableCell>{session.meter_stop?.toFixed(2) || 'N/A'}</TableCell>
                          <TableCell>{(session.meter_stop && session.meter_start) ? (session.meter_stop - session.meter_start).toFixed(2) : 'N/A'}</TableCell>
                          <TableCell>{session.stop_reason || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {hasMoreChargingSessions && (
                    <Button onClick={() => fetchChargingSessions(chargingSessionsPage + 1, true)} disabled={isLoadingChargingSessions} className="mt-4">
                        {isLoadingChargingSessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load More Sessions
                    </Button>
                )}
                </>
              ) : (
                <p>No charging sessions found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center text-primary">
                <Settings className="mr-2" /> Settings (Legacy Register Control)
              </CardTitle>
              <CardDescription>These settings directly write to inverter/charger registers. For command-based controls, see "Instant Control" tab.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2">Solar Charging (Inverter Setting 106)</h4>
                  <div className="flex items-center space-x-2">
                    <Switch checked={settings.solarCharging} onCheckedChange={handleToggleSolarCharging} disabled={!apiKey || !inverterSerial} />
                    <Label>Enable Solar Charging (SuperEco Mode)</Label>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Plug and Charge (Charger Setting 616)</h4>
                  <div className="flex items-center space-x-2">
                    <Switch checked={settings.plugAndCharge} onCheckedChange={handleTogglePlugAndCharge} disabled={!apiKey || !evChargerData?.uuid} />
                    <Label>Enable Plug and Charge (Register)</Label>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Home Battery Discharge to EVC (kW) (Inverter Setting 107)</h4>
                  <div className="flex items-center space-x-4">
                    <Slider min={0} max={7} step={0.1} value={[settings.maxBatteryDischargeToEvc]} onValueChange={handleSetMaxBatteryDischargeToEvc} className="w-64" disabled={!apiKey || !inverterSerial} />
                    <span>{settings.maxBatteryDischargeToEvc.toFixed(1)} kW</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Charge Rate Limit (Amps) (Charger Setting 621)</h4>
                  <div className="flex items-center space-x-4">
                    <Slider min={6} max={32} step={1} value={[settings.chargeRate]} onValueChange={handleSetChargeRate} className="w-64" disabled={!apiKey || !evChargerData?.uuid} />
                    <span>{settings.chargeRate} Amps</span>
                  </div>
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
};

export default EVChargerPage;

