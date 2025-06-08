
"use client"

import { useState, useEffect, useCallback } from "react";
import type { RealTimeData } from "@/lib/types";
import { getRealTimeData } from "@/lib/givenergy";
import { useToast } from "@/hooks/use-toast";

const REFRESH_INTERVAL = 15000; // 15 seconds
const HIGH_CONSUMPTION_THRESHOLD = 2.5; // kW from grid

export function useGivEnergyData(apiKey: string | null) {
  const [data, setData] = useState<RealTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!apiKey) {
      setData(null);
      setError("API Key not provided. Please enter your GivEnergy API key.");
      setIsLoading(false); // Ensure loading state is reset
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newData = await getRealTimeData(apiKey);
      setData(newData);

      // High consumption alert
      if (newData.grid.flow === 'importing' && typeof newData.grid.value === 'number' && newData.grid.value > HIGH_CONSUMPTION_THRESHOLD) {
        toast({
          title: "High Grid Consumption Alert",
          description: `Currently importing ${newData.grid.value} ${newData.grid.unit} from the grid.`,
          variant: "destructive",
          duration: 10000,
        });
      }

    } catch (e: any) {
      console.error("Error in useGivEnergyData fetchData:", e);
      // e.message should now be the more detailed error from _fetchGivEnergyAPI or other specific errors
      setError(e.message || "An unexpected error occurred while fetching data. Please check your API key, network connection, and ensure your GivEnergy devices are online and correctly configured.");
      setData(null); // Clear data on error
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, toast]);

  useEffect(() => {
    if (apiKey) {
      fetchData(); // Initial fetch
      const intervalId = setInterval(fetchData, REFRESH_INTERVAL);
      return () => clearInterval(intervalId);
    } else {
      setData(null); // Clear data if API key is removed
      setError(null); // Clear error if API key is removed
      setIsLoading(false); // Ensure loading state is reset
    }
  }, [apiKey, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
