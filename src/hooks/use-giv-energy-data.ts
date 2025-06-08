
"use client"

import { useState, useEffect, useCallback } from "react";
import type { RealTimeData } from "@/lib/types";
import { getRealTimeData } from "@/lib/givenergy";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/hooks/use-app-settings";
import { appEventBus, REFRESH_DASHBOARD_EVENT, DATA_FETCH_COMPLETED_EVENT } from "@/lib/event-bus";

const HIGH_CONSUMPTION_THRESHOLD = 2.5; // kW from grid

export function useGivEnergyData(apiKey: string | null) {
  const [data, setData] = useState<RealTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { refreshInterval, isSettingsLoaded } = useAppSettings();

  const fetchData = useCallback(async (isManualRefresh: boolean = false) => {
    if (!apiKey) {
      setData(null);
      setError("API Key not provided. Please configure your API key in Settings.");
      setIsLoading(false);
      appEventBus.emit(DATA_FETCH_COMPLETED_EVENT); // Emit completion even if no API key
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
      setData(null); 
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
      appEventBus.emit(DATA_FETCH_COMPLETED_EVENT);
    }
  }, [apiKey, toast]);

  useEffect(() => {
    if (apiKey && isSettingsLoaded) { 
      fetchData(); 
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
      if (isSettingsLoaded) { // Ensure settings are loaded before emitting completion for no-API-key scenario
        appEventBus.emit(DATA_FETCH_COMPLETED_EVENT);
      }
    }
  }, [apiKey, fetchData, refreshInterval, isSettingsLoaded]);

  return { data, isLoading, error, refetch: () => fetchData(true) };
}
