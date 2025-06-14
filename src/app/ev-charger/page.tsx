'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // Assuming Button component
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sun, Moon, Contrast, ArrowLeft, PlugZap, CalendarDays, Power, LineChart, Settings } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useTheme, themes } from '@/hooks/use-theme';
import { useApiKey } from '@/hooks/use-api-key';


const EVChargerPage = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'high-contrast-light' | 'high-contrast-dark'>('light'); // Initialize with a default theme
  const [evChargerData, setEvChargerData] = useState<any>(null);

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
    Unknown: 'Unknown', // Added for clarity if status is null or undefined
  };
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    solarCharging: false, // This setting likely comes from the inverter, not the EV charger
    plugAndCharge: false,
    maxBatteryDischargeToEvc: 0,
    chargeRate: 6, // Default minimum charge rate
  });
  const [chartData, setChartData] = useState<any[]>([]); // Initialize chartData state

  const { inverterSerial, evChargerId: storedEvChargerId } = useApiKey();

  // Define data fetching function for settings
  const fetchSettings = async (chargerUuid: string | null) => {
    if (evChargerData?.uuid) { // Use evChargerData from state
        try {
            // Fetch plug and charge status (command_id 616)
            const plugAndChargeResponse = await fetch(`/api/givenergy/ev-charger/${evChargerData.uuid}/commands/616`);
            const plugAndChargeData = await plugAndChargeResponse.json();
            const plugAndChargeEnabled = plugAndChargeData?.data?.value === 1;

            // Fetch charge rate limit (command_id 621)
            const chargeRateResponse = await fetch(`/api/givenergy/ev-charger/${evChargerData.uuid}/commands/621`);
            const chargeRateData = await chargeRateResponse.json();
            const chargeRateLimit = chargeRateData?.data?.value;

            // Fetch max battery discharge to EVC (command_id 622 - Example, verify actual command ID)
            // Note: This might be part of inverter settings, need to confirm the correct API call.
            // For now, let's assume a placeholder fetch for battery discharge limit from EV Charger commands.
            // You might need to adjust this based on the actual GivEnergy API for inverter control settings related to EVC.
             const batteryDischargeResponse = await fetch(`/api/givenergy/ev-charger/${evChargerData.uuid}/commands/622`); // Replace 622 with the actual command ID if it exists for this setting
             const batteryDischargeData = await batteryDischargeResponse.json();
             const maxBatteryDischargeToEvc = batteryDischargeData?.data?.value || 0; // Default to 0 if not found

             // Fetch solar charging mode (This is likely an inverter setting, not an EV Charger command)
             // You might need to fetch inverter settings and check the mode.
             // As a placeholder, we'll assume a setting might exist here or needs a different API call.
             // const solarChargingResponse = await fetch(`/api/givenergy/inverter/settings/...`); // Replace with actual inverter settings endpoint
             // const solarChargingData = await solarChargingResponse.json();
             // const solarChargingEnabled = ... // Determine status from response


            setSettings(prevSettings => ({
              ...prevSettings,
              plugAndCharge: plugAndChargeEnabled,
              chargeRate: chargeRateLimit,
              maxBatteryDischargeToEvc: maxBatteryDischargeToEvc,
             // solarCharging: solarChargingEnabled // Uncomment and implement when inverter settings fetching is added
            }));
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    } else {
      console.warn('Cannot fetch settings without a charger UUID.');
    }
};

  // Define data fetching function for schedules
  const fetchSchedules = async () => {
    console.log('Fetching schedules...');
    if (evChargerData?.uuid) {
      try {
        const response = await fetch(`/api/givenergy/ev-charger/${evChargerData.uuid}/commands/set-schedule`);
        const data = await response.json();
        setSchedules(data.data); // Assuming the response has a data field with an array of schedules
      } catch (error) {
        console.error('Error fetching schedules:', error);
      }
    }
  };

  // Define data fetching functions outside of useEffect
  const fetchEvChargerData = useCallback(async () => {
    try {
      // Fetch charger UUID and online status
      const chargerResponse = await fetch('/api/givenergy/ev-charger');
      const chargerData = await chargerResponse.json();

      let chargerUuid = null;
      if (chargerData && chargerData.data && chargerData.data.length > 0 && chargerData.data[0].uuid) {
        // Use the UUID from the first charger in the list if available
        chargerUuid = chargerData.data[0].uuid;
      } else if (storedEvChargerId) {
        // If no UUID from the list, use the stored EV charger ID
        console.log(`No charger found in list, using stored ID: ${storedEvChargerId}`);
        chargerUuid = storedEvChargerId;
      }

      if (chargerUuid) {
        // Now fetch details for the identified charger
        const specificChargerResponse = await fetch(`/api/givenergy/ev-charger/${chargerUuid}`);
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

          // Fetch latest meter data
        const meterResponse = await fetch(`/api/givenergy/ev-charger/${chargerUuid}/meter-data`);
        const meterData = await meterResponse.json();
        let currentPower = null;
        if (meterData && meterData.data && meterData.data.length > 0) {
            const latestMeterReading = meterData.data[0];
            // Assuming measurand_id 13 is Power.Active.Import (kW)
            const powerMeasurand = latestMeterReading.readings.find((reading: any) => reading.measurand_id === 13);
            if (powerMeasurand) {
              currentPower = powerMeasurand.value;
            }
             setEvChargerData(prevData => ({ ...prevData, current_power: currentPower }));
        }

        // Fetch historical meter data for analytics
        const historicalMeterResponse = await fetch(`/api/givenergy/ev-charger/${chargerUuid}/meter-data?page=1&pageSize=50`); // Fetching last 50 readings for chart
        const historicalMeterData = await historicalMeterResponse.json();
        if (historicalMeterData && historicalMeterData.data) {
          const formattedData = historicalMeterData.data.map((reading: any) => {
            const powerMeasurand = reading.readings.find((r: any) => r.measurand_id === 13);
            return {
              time: new Date(reading.timestamp).toLocaleTimeString(),
              power: powerMeasurand ? powerMeasurand.value : 0,
            };
          });
          setChartData(formattedData.reverse());
          setAnalyticsData(historicalMeterData.data); // Assuming analyticsData is used for summary
        }
      } else {
         console.error('Failed to fetch specific EV charger details using UUID:', chargerUuid);
         setEvChargerData(null); // Clear state on error
      }
      } else {
         console.warn('No EV charger UUID available from list or stored ID.');
         setEvChargerData(null); // Clear state if no UUID is available
      }

    } catch (error) {
      console.error('Error fetching EV charger data:', error);
      setEvChargerData(null); // Set to null on error
   }
  }, []); // Empty dependency array means this effect runs once on mount

  // Separate effect to fetch initial data on mount
  useEffect(() => {
  }, []); // Empty dependency array means this effect runs once on mount

  // Separate effect to fetch settings and schedules when evChargerData is available
  useEffect(() => {
    fetchSettings(evChargerData?.uuid);
    fetchSchedules();
  }, [evChargerData?.uuid]); // Run this effect when evChargerData.uuid changes

  const handleStartCharge = async () => {
    console.log('Starting charge...');
    try {
      const response = await fetch('/api/givenergy/ev-charger/commands/start-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargerUuid: evChargerData?.uuid }), // Assuming uuid is available in evChargerData
      });
      const data = await response.json();
      console.log('Start charge response:', data);
    } catch (error) {
      console.error('Error starting charge:', error);
    }
  };

  const handleStopCharge = async () => {
    // Implement Stop Charge API call
    console.log('Stopping charge...');
    try {
      const response = await fetch('/api/givenergy/ev-charger/commands/stop-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargerUuid: evChargerData?.uuid }), // Assuming uuid is available in evChargerData
      });
      const data = await response.json();
      console.log('Stop charge response:', data);
    } catch (error) {
      console.error('Error stopping charge:', error);
    }
  };

  const handleToggleSolarCharging = async (checked: boolean) => {
    setSettings(prevSettings => ({ ...prevSettings, solarCharging: checked }));
    // Call configure-inverter-control API with mode: SuperEco or Eco based on 'checked'
    console.log('Toggling solar charging:', checked);
    try {
      const response = await fetch('/api/givenergy/inverter/commands/configure-inverter-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inverterSerial: 'YOUR_INVERTER_SERIAL', // Replace with actual inverter serial
          mode: checked ? 'SuperEco' : 'Eco',
        }),
      });
      const data = await response.json();
      console.log('Solar charging toggle response:', data);
    } catch (error) {
      console.error('Error toggling solar charging:', error);
    }
  };

  const handleTogglePlugAndCharge = async (checked: boolean) => {
    setSettings(prevSettings => ({ ...prevSettings, plugAndCharge: checked }));
    // Call set-plug-and-go API
    console.log('Toggling plug and charge:', checked);
    try {
      const response = await fetch(`/api/givenergy/ev-charger/${evChargerData?.uuid}/commands/set-plug-and-go`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: checked }),
      });
      const data = await response.json();
      console.log('Plug and charge toggle response:', data);
    } catch (error) {
      console.error('Error toggling plug and charge:', error);
    }
  };

  const handleSetMaxBatteryDischargeToEvc = async (value: number[]) => {
    setSettings(prevSettings => ({ ...prevSettings, maxBatteryDischargeToEvc: value[0] }));
    // Call configure-inverter-control API with max_battery_discharge_power_to_evc
    console.log('Setting max battery discharge to EVC:', value[0]);
    try {
      const response = await fetch('/api/givenergy/inverter/commands/configure-inverter-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inverterSerial: 'YOUR_INVERTER_SERIAL', // Replace with actual inverter serial
          max_battery_discharge_power_to_evc: value[0],
        }),
      });
      const data = await response.json();
      console.log('Max battery discharge to EVC response:', data);
    } catch (error) {
      console.error('Error setting max battery discharge to EVC:', error);
    }
  };

  const handleAddSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Implement Add Schedule API call
    console.log('Adding schedule...');
    // Extract form data and send to API
    // Refresh schedules after successful addition
  };

  const handleSetActiveSchedule = async (scheduleId: string) => {
    // Implement Set Active Schedule API call
    console.log('Setting active schedule:', scheduleId);
    try {
      const response = await fetch(`/api/givenergy/ev-charger/${evChargerData?.uuid}/commands/set-active-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId }),
      });
      const data = await response.json();
      console.log('Set active schedule response:', data);
      // Optionally, update UI to reflect the active schedule
    } catch (error) {
      console.error('Error setting active schedule:', error);
    }
  };

  const handleSetChargeRate = useCallback(async (value: number[]) => {
    setSettings(prevSettings => ({ ...prevSettings, chargeRate: value[0] }));
    // Call adjust-charge-power-limit API
    console.log('Setting charge rate:', value[0]);
    try {
      const response = await fetch(`/api/givenergy/ev-charger/${evChargerData?.uuid}/commands/adjust-charge-power-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeRate: value[0] }),
      });
      const data = await response.json();
      console.log('Set charge rate response:', data);
    } catch (error) {
      console.error('Error setting charge rate:', error);
    }
  }, [evChargerData?.uuid]);

  return (
    <div className={`min-h-screen p-8`} >
      <div className="flex justify-between items-center mb-8" >
        <h1 className="text-3xl font-bold" style={{ color: themes[theme as keyof typeof themes]?.primary }}>EV Charger</h1>
        <div className="flex items-center space-x-4"> {/* Keep this div for the Dashboard button */}
          <Link href="/" passHref>
            <Button className="flex items-center" style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }}>
              <ArrowLeft className="mr-2" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <label htmlFor="theme-select" className="mr-4 font-medium">Select Theme:</label>
        <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'high-contrast-light' | 'high-contrast-dark')}
                className="p-2 rounded" style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }}>
          {Object.keys(themes).map(themeKey => (
            <option key={themeKey} value={themeKey}>{themeKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
          ))}
        </select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full overflow-x-auto grid-cols-5">
          <TabsTrigger value="overview" className="data-[state=active]:text-primary data-[state=inactive]:text-text" style={{
              color: themes[theme as keyof typeof themes]?.text,
              backgroundColor: themes[theme as keyof typeof themes]?.secondary,
              '--radix-tabs-trigger-background-color': themes[theme as keyof typeof themes]?.secondary, // Ensure background is secondary
            }}>Overview</TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:text-primary data-[state=inactive]:text-text"  style={{
              color: themes[theme as keyof typeof themes]?.text,
              backgroundColor: themes[theme as keyof typeof themes]?.secondary,
              '--radix-tabs-trigger-background-color': themes[theme as keyof typeof themes]?.secondary, // Ensure background is secondary
            }}>Schedule</TabsTrigger>
          <TabsTrigger value="control" className="data-[state=active]:text-primary data-[state=inactive]:text-text"  style={{
              color: themes[theme as keyof typeof themes]?.text,
              backgroundColor: themes[theme as keyof typeof themes]?.secondary,
              '--radix-tabs-trigger-background-color': themes[theme as keyof typeof themes]?.secondary, // Ensure background is secondary
            }}>Instant Control</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:text-primary data-[state=inactive]:text-text"  style={{
 color: themes[theme as keyof typeof themes]?.text,
              backgroundColor: themes[theme as keyof typeof themes]?.secondary,
              '--radix-tabs-trigger-background-color': themes[theme as keyof typeof themes]?.secondary, // Ensure background is secondary
            }}>Analytics</TabsTrigger>
 <TabsTrigger value="settings"  style={{
 color: themes[theme as keyof typeof themes]?.text,
              backgroundColor: themes[theme as keyof typeof themes]?.secondary,
            }}>Settings</TabsTrigger>
 </TabsList>
        <TabsContent value="overview">
          <Card className="mt-4" style={{ backgroundColor: themes[theme as keyof typeof themes]?.secondary, color: themes[theme as keyof typeof themes]?.text, borderColor: themes[theme as keyof typeof themes]?.primary }}>
            <CardHeader>
              <CardTitle style={{ color: themes[theme as keyof typeof themes]?.primary }}>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    <span>Type: {evChargerData?.type || 'N/A'}</span>
  </div>
  <div className="flex items-center">
    <span>Serial Number: {evChargerData?.serial_number || 'N/A'}</span>
  </div>
  <div className="flex items-center">
    <span>UUID: {evChargerData?.uuid || 'N/A'}</span>
  </div>
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
                  {schedules.map((schedule) => (
                    <li key={schedule.id} className="mb-2 p-2 border rounded" style={{ borderColor: themes[theme as keyof typeof themes]?.accent }}>
                      <div className="flex justify-between items-center">
                        <span>{schedule.name}: {schedule.startTime} - {schedule.endTime} ({schedule.days.join(', ')})</span>
                        <Button onClick={() => handleSetActiveSchedule(schedule.id)} style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof typeof themes]?.secondary }}>Set Active</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No schedules found.</p>
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
                    <input type="time" id="endTime" name="endTime" className="mt-1 block w-full p-2 rounded" style={{ backgroundColor: themes[theme as keyof typeof themes]?.accent, color: themes[theme as keyof themes]?.secondary }} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: themes[theme as keyof typeof themes]?.text }}>Days of Week</label>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                    <label key={day} className="inline-flex items-center mr-4">
                      <input type="checkbox" className="form-checkbox" name="days" value={day} style={{ color: themes[theme as keyof typeof themes]?.primary }} />
                      <span className="ml-2">{day}</span>
                    </label>
                  ))}
                </div>
                <Button type="submit" style={{ backgroundColor: themes[theme as keyof typeof themes]?.primary, color: themes[theme as keyof typeof themes]?.secondary }}>Add Schedule</Button>
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
              <Button
                onClick={handleStartCharge}
                style={{
                  backgroundColor: themes[theme as keyof typeof themes]?.accent,
                  color: themes[theme as keyof typeof themes]?.secondary,
                }}
              >
                Start Charging
              </Button>
              <Button
                onClick={handleStopCharge}
                style={{
                  backgroundColor: themes[theme as keyof typeof themes]?.accent,
                  color: themes[theme as keyof typeof themes]?.secondary,
                }}
              >
                Stop Charging
              </Button>
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
              <p>Total Energy Imported: {analyticsData.length > 0 ? `${analyticsData.reduce((sum, data) => sum + data.power, 0).toFixed(2)} kWh` : 'N/A'}</p>

              <h3 className="text-xl font-semibold mt-6 mb-4" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Historical Charging Power</h3>

              <div style={{ width: '100%', height: 300 }}>
                {/* Assuming chartData is available */}
                {chartData.length > 0 ? ( // Use chartData for charting
                <ResponsiveContainer>
                  <AreaChart
                    data={chartData}
                    margin={ {
                      top: 10,
                      right: 30,
                      left: 0,
                      bottom: 0,
                    }}
                  >
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
 <Settings className="mr-2" size={24} />
            Settings
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-6">
 <div>
 <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Solar Charging</h4>
 <label className="flex items-center cursor-pointer">
 <Switch
 checked={settings.solarCharging}
 onCheckedChange={handleToggleSolarCharging}
 />
 <div className="ml-3 text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>Enable Solar Charging (SuperEco Mode)</div>
 </label>
 </div>

 <div>
 <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Plug and Charge</h4>
 <label className="flex items-center cursor-pointer">
 <Switch checked={settings.plugAndCharge} onCheckedChange={handleTogglePlugAndCharge} />
 <div className="ml-3 text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>Enable Plug and Charge</div>
 </label>
 </div>

 <div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Home Battery Discharge to EVC (kW)</h4>
 <div className="flex items-center space-x-4">
 <Slider
                  min={0}
                  max={10} // Adjust max value based on typical battery discharge limits
                  step={0.1}
 value={[settings.maxBatteryDischargeToEvc]}
 onValueChange={handleSetMaxBatteryDischargeToEvc}
 className="w-64"
                   style={{ '--slider-thumb-background': themes[theme as keyof typeof themes]?.primary, '--slider-track-background': themes[theme as keyof typeof themes]?.accent } as React.CSSProperties}
 />
 <span className="text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>{settings.maxBatteryDischargeToEvc.toFixed(1)} kW</span>
 </div>
 </div>

 <div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>Charge Rate Limit (Amps)</h4>
 <div className="flex items-center space-x-4">
 <Slider
                  min={6}
                  max={32}
                  step={1}
 value={[settings.chargeRate]}
 onValueChange={handleSetChargeRate}
 className="w-64"
                   style={{ '--slider-thumb-background': themes[theme as keyof typeof themes]?.primary, '--slider-track-background': themes[theme as keyof typeof themes]?.accent } as React.CSSProperties}
 />
 <span className="text-sm font-medium" style={{ color: themes[theme as keyof typeof themes]?.text }}>{settings.chargeRate} Amps</span>
 </div>
 </div>

 <div>
              <h4 className="text-lg font-semibold mb-2" style={{ color: themes[theme as keyof typeof themes]?.primary }}>More Settings Coming Soon</h4>
 {/* This section could dynamically list other available commands or provide input for less common settings */}
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