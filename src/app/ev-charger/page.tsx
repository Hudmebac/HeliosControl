
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sun, Moon, Contrast, ArrowLeft, PlugZap, CalendarDays, Power, LineChart, Settings, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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

  const getAuthHeaders = useCallback(() => {
    if (!apiKey) return {};
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }, [apiKey]);

  const fetchSettings = useCallback(async (chargerUuid: string | null) => {
    if (!apiKey || !chargerUuid) {
      console.warn('Cannot fetch settings without API key or charger UUID.');
      return;
    }
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
      console.error('Error fetching settings:', error);
    }
  }, [apiKey, getAuthHeaders]);

  const fetchSchedules = useCallback(async (chargerUuid: string | null) => {
    if (!apiKey || !chargerUuid) {
      console.warn('Cannot fetch schedules without API key or charger UUID.');
      return;
    }
    console.log('Fetching schedules...');
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${chargerUuid}/read/606`, { headers }); 
      const data = await response.json();
      setSchedules(data.data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  }, [apiKey, getAuthHeaders]);

  const fetchEvChargerData = useCallback(async () => {
    if (!apiKey) {
      setIsLoadingEvData(false);
      setEvChargerData(null);
      return;
    }
    setIsLoadingEvData(true);
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
          console.error('Failed to fetch specific EV charger details using UUID:', chargerUuid);
          setEvChargerData(null);
        }
      } else {
        console.warn('No EV charger UUID available from list or stored ID.');
        setEvChargerData(null);
      }
    } catch (error) {
      console.error('Error fetching EV charger data:', error);
      setEvChargerData(null);
    } finally {
      setIsLoadingEvData(false);
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
      fetchSettings(evChargerData.uuid);
      fetchSchedules(evChargerData.uuid);
    }
  }, [evChargerData?.uuid, apiKey, fetchSettings, fetchSchedules]);

  const handleApiError = async (response: Response, operationName: string) => {
    let errorPayload: { error?: string; message?: string; details?: any } = {
      message: `Error ${operationName}: Request failed with status ${response.status}`,
    };
    try {
      const parsedJson = await response.json();
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        if (parsedJson.error || parsedJson.message) {
          errorPayload = { ...parsedJson, ...errorPayload }; // Prioritize parsed error/message
        } else {
          errorPayload.details = parsedJson; // Parsed but no standard error fields
        }
      } else {
         errorPayload.details = "Response was not a standard JSON error object.";
      }
    } catch (e) {
      errorPayload.details = "Response was not valid JSON.";
    }
    console.error(`Error in ${operationName}:`, errorPayload.error || errorPayload.message, errorPayload.details ? errorPayload.details : '');
    toast({
      variant: "destructive",
      title: `${operationName.charAt(0).toUpperCase() + operationName.slice(1)} Failed`,
      description: String(errorPayload.error || errorPayload.message || "An unknown error occurred."),
    });
  };

  const handleStartCharge = async () => {
    if (!apiKey || !evChargerData?.uuid) return;
    console.log('Starting charge...');
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/control/705`, { 
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: 1 }), 
      });
      if (!response.ok) {
        await handleApiError(response, 'starting charge');
        return;
      }
      try {
        // Attempt to parse JSON, but don't fail if it's empty for success
        const textResponse = await response.text();
        if (textResponse) {
          const data = JSON.parse(textResponse);
          console.log('Start charge response:', data);
        } else {
          console.log('Start charge command successful, no JSON content in response.');
        }
      } catch (e) {
        console.log('Start charge command successful, response was not valid JSON (may be empty).');
      }
      fetchEvChargerData(); 
    } catch (error) {
      console.error('Network or unexpected error starting charge:', error);
      toast({ variant: "destructive", title: "Start Charge Error", description: "An unexpected error occurred." });
    }
  };

  const handleStopCharge = async () => {
    if (!apiKey || !evChargerData?.uuid) return;
    console.log('Stopping charge...');
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/control/706`, { 
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: 1 }), 
      });
      if (!response.ok) {
        await handleApiError(response, 'stopping charge');
        return;
      }
      try {
        const textResponse = await response.text();
        if (textResponse) {
          const data = JSON.parse(textResponse);
          console.log('Stop charge response:', data);
        } else {
          console.log('Stop charge command successful, no JSON content in response.');
        }
      } catch (e) {
         console.log('Stop charge command successful, response was not valid JSON (may be empty).');
      }
      fetchEvChargerData(); 
    } catch (error) {
      console.error('Network or unexpected error stopping charge:', error);
      toast({ variant: "destructive", title: "Stop Charge Error", description: "An unexpected error occurred." });
    }
  };

  const handleToggleSolarCharging = async (checked: boolean) => {
    if (!apiKey || !inverterSerial) return;
    setSettings(prevSettings => ({ ...prevSettings, solarCharging: checked }));
    console.log('Toggling solar charging:', checked);
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
      try {
        const textResponse = await response.text();
        if (textResponse) {
          const data = JSON.parse(textResponse);
          console.log('Solar charging toggle response:', data);
        } else {
          console.log('Toggle solar charging successful, no JSON content in response.');
        }
      } catch (e) {
        console.log('Toggle solar charging successful, response was not valid JSON (may be empty).');
      }
    } catch (error) {
      console.error('Network or unexpected error toggling solar charging:', error);
      toast({ variant: "destructive", title: "Solar Charging Error", description: "An unexpected error occurred." });
    }
  };

  const handleTogglePlugAndCharge = async (checked: boolean) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setSettings(prevSettings => ({ ...prevSettings, plugAndCharge: checked }));
    console.log('Toggling plug and charge:', checked);
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/settings/616/write`, { 
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: checked ? 1 : 0 }),
      });
      if (!response.ok) {
         await handleApiError(response, 'toggling plug and charge');
        return;
      }
      try {
        const textResponse = await response.text();
        if (textResponse) {
          const data = JSON.parse(textResponse);
          console.log('Plug and charge toggle response:', data);
        } else {
          console.log('Toggle plug and charge successful, no JSON content in response.');
        }
      } catch (e) {
        console.log('Toggle plug and charge successful, response was not valid JSON (may be empty).');
      }
    } catch (error) {
      console.error('Network or unexpected error toggling plug and charge:', error);
      toast({ variant: "destructive", title: "Plug & Charge Error", description: "An unexpected error occurred." });
    }
  };

  const handleSetMaxBatteryDischargeToEvc = async (value: number[]) => {
     if (!apiKey || !inverterSerial) return;
    setSettings(prevSettings => ({ ...prevSettings, maxBatteryDischargeToEvc: value[0] }));
    console.log('Setting max battery discharge to EVC:', value[0]);
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
      try {
        const textResponse = await response.text();
        if (textResponse) {
          const data = JSON.parse(textResponse);
          console.log('Max battery discharge to EVC response:', data);
        } else {
          console.log('Set max battery discharge successful, no JSON content in response.');
        }
      } catch (e) {
        console.log('Set max battery discharge successful, response was not valid JSON (may be empty).');
      }
    } catch (error) {
      console.error('Network or unexpected error setting max battery discharge to EVC:', error);
      toast({ variant: "destructive", title: "Battery Discharge Error", description: "An unexpected error occurred." });
    }
  };
  
  const handleSetChargeRate = useCallback(async (value: number[]) => {
    if (!apiKey || !evChargerData?.uuid) return;
    setSettings(prevSettings => ({ ...prevSettings, chargeRate: value[0] }));
    console.log('Setting charge rate:', value[0]);
    try {
      const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/settings/621/write`, { 
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ value: value[0] }),
      });
      if (!response.ok) {
        await handleApiError(response, 'setting charge rate');
        return;
      }
      try {
        const textResponse = await response.text();
        if (textResponse) {
          const data = JSON.parse(textResponse);
          console.log('Set charge rate response:', data);
        } else {
          console.log('Set charge rate successful, no JSON content in response.');
        }
      } catch (e) {
        console.log('Set charge rate successful, response was not valid JSON (may be empty).');
      }
    } catch (error) {
      console.error('Network or unexpected error setting charge rate:', error);
      toast({ variant: "destructive", title: "Charge Rate Error", description: "An unexpected error occurred." });
    }
  }, [apiKey, evChargerData?.uuid, getAuthHeaders, toast]);


  const handleAddSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiKey || !evChargerData?.uuid) return;
    console.log('Adding schedule...');
    // Extract form data, construct payload as per GivEnergy API for schedules
    // Example: const payload = { name: "New Schedule", startTime: "23:00", ... };
    // try {
    //   const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/settings/606/write`, {
    //     method: 'POST',
    //     headers: getAuthHeaders(),
    //     body: JSON.stringify(payload),
    //   });
    //   if (!response.ok) { await handleApiError(response, 'adding schedule'); return; }
    //   // process response
    //   fetchSchedules(evChargerData.uuid);
    // } catch (error) { /* ... error handling ... */ }
  };

  const handleSetActiveSchedule = async (scheduleId: string) => {
    if (!apiKey || !evChargerData?.uuid) return;
    console.log('Setting active schedule:', scheduleId);
    // try {
      // const response = await fetch(`/api/proxy-givenergy/ev-charger/${evChargerData.uuid}/settings/607/write`, {
      //   method: 'POST',
      //   headers: getAuthHeaders(),
      //   body: JSON.stringify({ value: scheduleId }), 
      // });
      // if (!response.ok) { await handleApiError(response, 'setting active schedule'); return; }
      // // process response
    // } catch (error) { /* ... error handling ... */ }
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
    <div className="min-h-screen p-8">
      <div className="flex justify-between items-center mb-8 text-primary">
        <h1 className="text-3xl font-bold">EV Charger</h1>
        <div className="flex items-center space-x-4">
          <Link href="/" passHref>
            <Button className="flex items-center bg-accent text-secondary">
              <ArrowLeft className="mr-2" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto grid-cols-5">
           <TabsTrigger value="overview" className="data-[state=active]:text-primary data-[state=inactive]:text-text" style={{ color: themes[theme as keyof typeof themes]?.text, }}>Overview</TabsTrigger>
           <TabsTrigger value="schedule" className="data-[state=active]:text-primary data-[state=inactive]:text-text" style={{ color: themes[theme as keyof typeof themes]?.text, }}>Schedule</TabsTrigger>
           <TabsTrigger value="control" className="data-[state=active]:text-primary data-[state=inactive]:text-text" style={{ color: themes[theme as keyof typeof themes]?.text, }}>Instant Control</TabsTrigger>
           <TabsTrigger value="analytics" className="data-[state=active]:text-primary data-[state=inactive]:text-text" style={{ color: themes[theme as keyof typeof themes]?.text, }}>Analytics</TabsTrigger>
           <TabsTrigger value="settings" className="data-[state=active]:text-primary data-[state=inactive]:text-text" style={{ color: themes[theme as keyof typeof themes]?.text, }}>Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card className="mt-4" style={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, color: themes[theme as keyof typeof themes]?.text, borderColor: themes[theme as keyof typeof themes]?.primary }}>
            <CardHeader>
              <CardTitle style={{ color: themes[theme as keyof typeof themes]?.primary }}>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {evChargerData ? (
                <>
                  <div className="flex items-center">
                    <PlugZap className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>Charger Online: {evChargerData?.online ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex items-center">
                    <Power className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>Current Charging Power: {evChargerData?.current_power ? `${evChargerData.current_power} kW` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <CalendarDays className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>EV Charger Status: {evChargerStatusMap[evChargerData?.status || 'Unknown']}</span>
                  </div>
                  <div className="flex items-center">
                    <CalendarDays className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>Last Offline: {evChargerData?.went_offline_at ? new Date(evChargerData.went_offline_at).toLocaleString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <PlugZap className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>Type: {evChargerData?.type || 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <PlugZap className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>Serial Number: {evChargerData?.serial_number || 'N/A'}</span>
                  </div>
                  <div className="flex items-center">
                    <PlugZap className="mr-2" size={24} color={themes[theme as keyof typeof themes]?.primary} />
                    <span>UUID: {evChargerData?.uuid || 'N/A'}</span>
                  </div>
                </>
              ) : (
                <p>No EV charger data found or could not be loaded. Please check your API key and charger connection.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="schedule">
          <Card className="mt-4" style={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, color: themes[theme as keyof typeof themes]?.text, borderColor: themes[theme as keyof typeof themes]?.primary }}>
            <CardHeader>
              <CardTitle style={{ color: themes[theme as keyof typeof themes]?.primary }}>Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold mb-4" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Existing Schedules</h3>
              {schedules.length > 0 ? (
                <ul>
                  {schedules.map((schedule: any) => ( 
                    <li key={schedule.id} className="mb-2 p-2 border rounded" style={{ borderColor: themes[theme as keyof typeof themes]?.accent }}>
                      <div className="flex justify-between items-center">
                        <span>{schedule.name || `Schedule ${schedule.id}`}: {schedule.start_time} - {schedule.finish_time} ({schedule.days?.join(', ') || 'N/A'})</span>
                        <Button onClick={() => handleSetActiveSchedule(schedule.id)} style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }}>Set Active</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No schedules found or could not be loaded.</p>
              )}

              <h3 className="text-xl font-semibold mt-6 mb-4" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Add New Schedule</h3>
              <form onSubmit={handleAddSchedule} className="space-y-4">
                <div>
                  <label htmlFor="scheduleName" className="block text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>Schedule Name</label>
                  <input type="text" id="scheduleName" name="scheduleName" className="mt-1 block w-full p-2 rounded" style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>Start Time</label>
                    <input type="time" id="startTime" name="startTime" className="mt-1 block w-full p-2 rounded" style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }} />
                  </div>
                  <div>
                    <label htmlFor="endTime" className="block text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>End Time</label>
                    <input type="time" id="endTime" name="endTime" className="mt-1 block w-full p-2 rounded" style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: themes[theme as keyof typeof themes]?.text }}>Days of Week</label>
                  <label key="All" className="inline-flex items-center mr-4">
                    <input type="checkbox" className="form-checkbox" name="days" value="All" style={{ color: themes[theme as keyof typeof themes]?.primary }}
                      onChange={(e) => {
                        const checkboxes = document.querySelectorAll('input[name="days"]');
                        checkboxes.forEach((checkbox: any) => { checkbox.checked = e.target.checked; });
                      }} />
                    <span className="ml-2">All</span>
                  </label>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ( 
                    <label key={day} className="inline-flex items-center mr-4">
                      <input type="checkbox" className="form-checkbox" name="days" value={day} style={{ color: themes[theme as keyof typeof themes]?.primary }} />
                      <span className="ml-2">{day}</span>
                    </label>
                  ))}
                </div>
                <Button type="submit" style={{ backgroundColor: themes[theme as keyof typeof themes]?.primary, color: themes[theme as keyof typeof themes]?.secondary }} disabled={!apiKey}>Add Schedule</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="control">
          <Card className="mt-4" style={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, color: themes[theme as keyof typeof themes]?.text, borderColor: themes[theme as keyof typeof themes]?.primary }}>
            <CardHeader>
              <CardTitle style={{ color: themes[theme as keyof typeof themes]?.primary }}>Instant Control</CardTitle>
            </CardHeader>
            <CardContent className="flex space-x-4">
              <Button onClick={handleStartCharge} style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }} disabled={!apiKey || !evChargerData?.uuid}>Start Charging</Button>
              <Button onClick={handleStopCharge} style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }} disabled={!apiKey || !evChargerData?.uuid}>Stop Charging</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card className="mt-4" style={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, color: themes[theme as keyof typeof themes]?.text, borderColor: themes[theme as keyof typeof themes]?.primary }}>
            <CardHeader>
              <CardTitle style={{ color: themes[theme as keyof typeof themes]?.primary }}>Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="text-xl font-semibold mb-4" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Energy Usage Summary</h3>
              <p>Total Energy Imported (from chart data): {analyticsData.length > 0 ? `${analyticsData.reduce((sum, data) => sum + (data.power || 0), 0).toFixed(2)} kWh` : 'N/A'}</p>

              <h3 className="text-xl font-semibold mt-6 mb-4" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Historical Charging Power</h3>
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
                ) : (<p>No historical data available for charting.</p>)}
              </div>
              <p className="mt-4">Summary and energy graph analytics.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="mt-4" style={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, color: themes[theme as keyof typeof themes]?.text, borderColor: themes[theme as keyof typeof themes]?.primary }}>
            <CardHeader>
              <CardTitle className="flex items-center" style={{ color: themes[theme as keyof typeof themes]?.primary }}>
                <Settings className="mr-2" size={24} /> Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Solar Charging</h4>
                  <label className="flex items-center cursor-pointer">
                    <Switch checked={settings.solarCharging} onCheckedChange={handleToggleSolarCharging} disabled={!apiKey || !inverterSerial} />
                    <div className="ml-3 text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>Enable Solar Charging (SuperEco Mode)</div>
                  </label>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Plug and Charge</h4>
                  <label className="flex items-center cursor-pointer">
                    <Switch checked={settings.plugAndCharge} onCheckedChange={handleTogglePlugAndCharge} disabled={!apiKey || !evChargerData?.uuid} />
                    <div className="ml-3 text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>Enable Plug and Charge</div>
                  </label>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Home Battery Discharge to EVC (kW)</h4>
                  <div className="flex items-center space-x-4">
                    <Slider min={0} max={7} step={0.1} value={[settings.maxBatteryDischargeToEvc]} onValueChange={handleSetMaxBatteryDischargeToEvc} className="w-64" style={{ '--slider-thumb-background': themes[theme as keyof typeof themes]?.primary, '--slider-track-background': themes[theme as keyof typeof themes]?.accent } as React.CSSProperties} disabled={!apiKey || !inverterSerial} />
                    <span className="text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>{settings.maxBatteryDischargeToEvc.toFixed(1)} kW</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Charge Rate Limit (Amps)</h4>
                  <div className="flex items-center space-x-4">
                    <Slider min={6} max={32} step={1} value={[settings.chargeRate]} onValueChange={handleSetChargeRate} className="w-64" style={{ '--slider-thumb-background': themes[theme as keyof typeof themes]?.primary, '--slider-track-background': themes[theme as keyof typeof themes]?.accent } as React.CSSProperties} disabled={!apiKey || !evChargerData?.uuid} />
                    <span className="text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>{settings.chargeRate} Amps</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>More Settings Coming Soon</h4>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EVChargerPage;

      