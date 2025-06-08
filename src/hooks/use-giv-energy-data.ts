
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
      setError("API Key not provided.");
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
      console.error("Failed to fetch GivEnergy data:", e);
      setError(e.message || "Failed to fetch data. Check API key and connection.");
      setData(null); // Clear data on error to avoid showing stale info
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
    }
  }, [apiKey, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
