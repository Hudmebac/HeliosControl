
"use client"

import { useState, useEffect, useCallback } from "react";
import type { RealTimeData } from "@/lib/types";
import { getRealTimeData } from "@/lib/givenergy";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/hooks/use-app-settings";
import { appEventBus, REFRESH_DASHBOARD_EVENT, DATA_FETCH_COMPLETED_EVENT, EVCharger } from "@/lib/event-bus";

const HIGH_CONSUMPTION_THRESHOLD = 2.5; // kW from grid

export function useGivEnergyData(apiKey: string | null) {
  const [data, setData] = useState<RealTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evChargersData, setEvChargersData] = useState<EVCharger[] | null>(null); // New state for EV chargers
  const [evChargerMeterData, setEvChargerMeterData] = useState<any[] | null>(null); // New state for EV charger meter data
  const [evChargersLoading, setEvChargersLoading] = useState(false); // Loading state for EV chargers
  const { toast } = useToast();
  const { refreshInterval, isSettingsLoaded } = useAppSettings();

  const fetchData = useCallback(async (isManualRefresh: boolean = false) => {
    if (!apiKey) {
      setData(null);
      setError("API Key not provided. Please configure your API key in Settings.");
      setIsLoading(false);
      appEventBus.emit(DATA_FETCH_COMPLETED_EVENT); // Emit completion even if no API key
      setEvChargersData(null); // Clear EV charger data
      setEvChargersLoading(false); // Stop EV charger loading
      setEvChargerMeterData(null); // Clear EV charger meter data
      return;
    }

    setIsLoading(true); // Still set overall loading for real-time data
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
      // Do NOT set data to null on error if data already exists
      // setData(null);
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
      // Don't emit completion here, wait for EV charger data if applicable
    }
  }, [apiKey, toast]);

  const fetchEvChargers = useCallback(async () => {
    if (!apiKey) {
      setEvChargersData(null);
      setEvChargersLoading(false);
      appEventBus.emit(DATA_FETCH_COMPLETED_EVENT);
      return;
    }

    setEvChargersLoading(true);
    try {
      const evChargerUrl = new URL("https://api.givenergy.cloud/v1/ev-charger");
      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      };
      const response = await fetch(evChargerUrl.toString(), { headers });
      if (!response.ok) {
        throw new Error(`Error fetching EV chargers: ${response.statusText}`);
      }
      const result = await response.json();
      setEvChargersData(result.data);

      // If chargers are found, fetch meter data for the first one
      if (result.data && result.data.length > 0) {
        const firstChargerUuid = result.data[0].uuid;
        const meterDataUrl = new URL(`https://api.givenergy.cloud/v1/ev-charger/${firstChargerUuid}/meter-data`);
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const meterDataParams = {
          start_time: twentyFourHoursAgo.toISOString(),
          end_time: now.toISOString(),
          'measurands[0]': '13', // Power.Active.Import (instantaneous power)
          'measurands[1]': '4', // Energy.Active.Import.Register (total energy)
          'meter_ids[0]': '0', // EV Charger meter
          pageSize: '1', // Get only the latest data point for instantaneous readings
          page: '1'
        };
        Object.keys(meterDataParams)
          .forEach(key => meterDataUrl.searchParams.append(key, meterDataParams[key as keyof typeof meterDataParams]));

        const meterDataResponse = await fetch(meterDataUrl.toString(), { headers });
        if (!meterDataResponse.ok) {
          throw new Error(`Error fetching EV charger meter data: ${meterDataResponse.statusText}`);
        }
        const meterDataResult = await meterDataResponse.json();
        // You would need to process meterDataResult and potentially add it to the RealTimeData or a new state
        setEvChargerMeterData(meterDataResult.data); // Store meter data
      }
    } catch (e: any) {
      console.error("Error fetching EV chargers:", e);
    }
  }, [apiKey, toast]);

  useEffect(() => {
    if (apiKey && isSettingsLoaded) { 
      fetchData();
      fetchEvChargers(); // Fetch EV chargers on mount and API key change
      const intervalMilliseconds = refreshInterval * 1000;
      const intervalId = setInterval(() => fetchData(false), intervalMilliseconds);
      
      const handleManualRefresh = () => fetchData(true);
      appEventBus.on(REFRESH_DASHBOARD_EVENT, handleManualRefresh);

      return () => {
        clearInterval(intervalId);
        appEventBus.off(REFRESH_DASHBOARD_EVENT, handleManualRefresh);
      };
    } else {
      setData(null);
      setIsLoading(false);
      setEvChargersData(null); // Clear EV charger data
      setEvChargerMeterData(null); // Clear EV charger meter data
      setEvChargersLoading(false); // Stop EV charger loading
      if (isSettingsLoaded) { // Ensure settings are loaded before emitting completion for no-API-key scenario
        appEventBus.emit(DATA_FETCH_COMPLETED_EVENT);
      }
    }
  }, [apiKey, fetchData, fetchEvChargers, refreshInterval, isSettingsLoaded]);
 return { data, isLoading: isLoading || evChargersLoading, error, evChargersData, evChargerMeterData, refetch: () => { fetchData(true); fetchEvChargers(); } };
}
