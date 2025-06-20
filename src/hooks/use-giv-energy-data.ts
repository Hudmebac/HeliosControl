
"use client"

import { useState, useEffect, useCallback } from "react";
import type { RealTimeData } from "@/lib/types";
import { getRealTimeData } from "@/lib/givenergy";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/hooks/use-app-settings";
import { appEventBus, REFRESH_DASHBOARD_EVENT, DATA_FETCH_COMPLETED_EVENT } from "@/lib/event-bus";
import type { EVCharger } from "@/lib/types"; // Correctly import EVCharger type

const HIGH_CONSUMPTION_THRESHOLD = 2.5; // kW from grid

export function useGivEnergyData(apiKey: string | null, fetchEvChargerData: boolean = true) {
  const [data, setData] = useState<RealTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evChargersData, setEvChargersData] = useState<EVCharger[] | null>(null);
  const [evChargerMeterData, setEvChargerMeterData] = useState<any[] | null>(null);
  const [evChargersLoading, setEvChargersLoading] = useState(false);
  const { toast } = useToast();
  const { refreshInterval, isSettingsLoaded } = useAppSettings();

  const fetchData = useCallback(async (isManualRefresh: boolean = false) => {
    if (!apiKey) {
      setData(null);
      setError("API Key not provided. Please configure your API key in Settings.");
      setIsLoading(false);
      appEventBus.emit(DATA_FETCH_COMPLETED_EVENT);
      setEvChargersData(null);
      setEvChargersLoading(false);
      setEvChargerMeterData(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newData = await getRealTimeData(apiKey);
      setData(newData);

      if (newData.grid.flow === 'importing' && typeof newData.grid.value === 'number' && newData.grid.value > HIGH_CONSUMPTION_THRESHOLD) {
        toast({
          title: "High Grid Consumption Alert",
          description: `Currently importing ${newData.grid.value} ${newData.grid.unit} from the grid.`,
          variant: "destructive",
          duration: 10000,
        });
      }
      if (isManualRefresh) {
        toast({
          title: "Dashboard Refreshed",
          description: "Data has been updated.",
          duration: 3000,
        });
      }

    } catch (e: unknown) {
      let errorMessage = "An unexpected error occurred while fetching data. Please check your API key, network connection, and ensure your GivEnergy devices are online and correctly configured.";
      if (e instanceof Error) {
        errorMessage = e.message;
      } else if (typeof e === 'string') {
        errorMessage = e;
      }
      console.error("Error in useGivEnergyData fetchData:", e);
      setError(errorMessage);
       if (isManualRefresh) {
        toast({
          title: "Refresh Failed",
          description: errorMessage,
          variant: "destructive",
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false);
      // Completion event is now emitted after EV charger data fetch attempt (if applicable)
    }
  }, [apiKey, toast]);

  const fetchEvChargers = useCallback(async () => {
    if (!apiKey) {
      setEvChargersData(null);
      setEvChargersLoading(false);
      setEvChargerMeterData(null);
      // appEventBus.emit(DATA_FETCH_COMPLETED_EVENT); // Emit completion here if no EV charger fetch
      return;
    }

    setEvChargersLoading(true);
    setEvChargerMeterData(null); // Clear previous meter data
    let fetchedChargers: EVCharger[] = [];

    try {
      const evChargerUrl = "/api/proxy-givenergy/ev-charger"; // Use proxy
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      };
      const response = await fetch(evChargerUrl, { headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error fetching EV chargers: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
      }
      const result = await response.json();
      fetchedChargers = result.data || [];
      setEvChargersData(fetchedChargers);

      if (fetchedChargers && fetchedChargers.length > 0 && fetchedChargers[0].uuid) {
        const firstChargerUuid = fetchedChargers[0].uuid;
        const meterDataProxyUrlPath = `/api/proxy-givenergy/ev-charger/${firstChargerUuid}/meter-data`; // Use proxy

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const meterDataParams = new URLSearchParams({
          start_time: twentyFourHoursAgo.toISOString(),
          end_time: now.toISOString(),
          'measurands[0]': '13',
          'measurands[1]': '4',
          'meter_ids[0]': '0',
          pageSize: '1',
          page: '1'
        });
        
        const fullMeterDataUrl = `${meterDataProxyUrlPath}?${meterDataParams.toString()}`;

        const meterDataResponse = await fetch(fullMeterDataUrl, { headers });
        if (!meterDataResponse.ok) {
            const errorData = await meterDataResponse.json().catch(() => ({}));
            console.warn(`Warning: Error fetching EV charger meter data: ${meterDataResponse.status} ${meterDataResponse.statusText}. ${errorData.message || ''}`);
            setEvChargerMeterData([]); // Set to empty or handle as needed
        } else {
            const meterDataResult = await meterDataResponse.json();
            setEvChargerMeterData(meterDataResult.data || []);
        }
      } else {
         setEvChargerMeterData([]); // No chargers, so no meter data
      }
    } catch (e: any) {
      console.error("Error fetching EV chargers or their meter data:", e);
      setEvChargersData([]); // Set to empty array on error to indicate fetch attempt was made
      setEvChargerMeterData([]);
      toast({
        title: "EV Charger Data Error",
        description: e.message || "Could not load EV Charger information.",
        variant: "destructive",
      });
    } finally {
      setEvChargersLoading(false);
      // appEventBus.emit(DATA_FETCH_COMPLETED_EVENT); // Emit completion after EV data attempt
    }
  }, [apiKey, toast]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    const performFetchCycle = async () => {
      await fetchData(); // Fetch main data
      if (fetchEvChargerData) {
        await fetchEvChargers(); // Then fetch EV charger data
      }
      appEventBus.emit(DATA_FETCH_COMPLETED_EVENT); // Emit completion after all fetches
    };
    
    if (apiKey && isSettingsLoaded) { 
      performFetchCycle(); // Initial fetch
      const intervalMilliseconds = refreshInterval * 1000;
      intervalId = setInterval(performFetchCycle, intervalMilliseconds);
      
      const handleManualRefresh = () => {
        // Clear existing interval to prevent rapid succession if manual refresh is quick
        if (intervalId) clearInterval(intervalId);
        performFetchCycle().finally(() => {
          // Restart interval after manual refresh cycle completes
          if (apiKey && isSettingsLoaded) { // Check again in case API key was cleared
            intervalId = setInterval(performFetchCycle, refreshInterval * 1000);
          }
        });
      };
      appEventBus.on(REFRESH_DASHBOARD_EVENT, handleManualRefresh);

      return () => {
        if (intervalId) clearInterval(intervalId);
        appEventBus.off(REFRESH_DASHBOARD_EVENT, handleManualRefresh);
      };
    } else {
      setData(null);
      setIsLoading(false);
      setEvChargersData(null);
      setEvChargerMeterData(null);
      setEvChargersLoading(false);
      setError(apiKey ? null : "API Key not provided. Please configure your API key in Settings.");
      if (isSettingsLoaded) {
        appEventBus.emit(DATA_FETCH_COMPLETED_EVENT);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, fetchEvChargerData, refreshInterval, isSettingsLoaded]); // fetchData and fetchEvChargers are memoized

 return { 
    data, 
    isLoading: isLoading || (fetchEvChargerData ? evChargersLoading : false), 
    error, 
    evChargersData, 
    evChargerMeterData, 
    refetch: () => { 
        // This refetch should also trigger the full cycle and restart interval
        const handleManualRefresh = () => {
            if (intervalId) clearInterval(intervalId);
            performFetchCycle().finally(() => {
                if (apiKey && isSettingsLoaded) {
                    intervalId = setInterval(performFetchCycle, refreshInterval * 1000);
                }
            });
        };
        appEventBus.emit(REFRESH_DASHBOARD_EVENT, handleManualRefresh);
    }, 
    fetchEvChargers // Exposing this though it's called internally by the cycle
  };
}

    