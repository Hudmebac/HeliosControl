"use client"

import { useState, useEffect, useCallback } from "react";
import { getDeviceIDs } from "@/lib/givenergy";
import type { GivEnergyIDs } from "@/lib/types";

const API_KEY_STORAGE_KEY = "helios-control-api-key";
const INVERTER_SERIAL_STORAGE_KEY = "helios-control-inverter-serial";
const EV_CHARGER_ID_STORAGE_KEY = "helios-control-ev-charger-id";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true); // Loading state specifically for API key from localStorage
  const [deviceIDs, setDeviceIDs] = useState<GivEnergyIDs | null>(null);
  const [isDeviceIDsLoading, setIsDeviceIDsLoading] = useState(true); // Set to true initially for device IDs load
  const [deviceIDsError, setDeviceIDsError] = useState<string | null>(null);
  const [isProcessingNewKey, setIsProcessingNewKey] = useState(false); // For save/import operations
  const [inverterSerial, setInverterSerial] = useState<string | null>(null);
  const [evChargerId, setEvChargerId] = useState<string | null>(null);

  // Effect to load API key and device IDs from local storage on mount
  useEffect(() => {
    try {
      const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    } catch (error) {
      console.error("Failed to load API key from localStorage:", error);
    } finally {
      setIsLoadingApiKey(false);
    }

    try {
      const storedInverterSerial = localStorage.getItem(INVERTER_SERIAL_STORAGE_KEY);
      const storedEvChargerId = localStorage.getItem(EV_CHARGER_ID_STORAGE_KEY);

      if (storedInverterSerial || storedEvChargerId) {
        setInverterSerial(storedInverterSerial);
        setEvChargerId(storedEvChargerId);
        setDeviceIDs({ inverterSerial: storedInverterSerial, evChargerId: storedEvChargerId });
        setIsDeviceIDsLoading(false); // Set loading to false if IDs are found in localStorage
      } else {
        setIsDeviceIDsLoading(false); // Set loading to false if no IDs are found in localStorage
      }

    } catch (error) {
      console.error("Failed to load device IDs from localStorage:", error);
      setIsDeviceIDsLoading(false); // Set loading to false on error
    }

  }, []); // Empty dependency array: runs only on mount

  const fetchAndSetDeviceIDs = useCallback(async (currentApiKey: string) => {
    if (!currentApiKey) {
      setDeviceIDs(null);
      setInverterSerial(null);
      setEvChargerId(null);
      setDeviceIDsError(null);
      return;
    }

    // Only show loading if an API call is about to be made
    if (!inverterSerial && !evChargerId) {
       setIsDeviceIDsLoading(true);
    }
    setDeviceIDsError(null);

    try {
      const ids = await getDeviceIDs(currentApiKey);
      // Update state
      setDeviceIDs(ids);
      setInverterSerial(ids?.inverterSerial || null);
      setEvChargerId(ids?.evChargerId || null);

      // Save to local storage
      if (ids?.inverterSerial) localStorage.setItem(INVERTER_SERIAL_STORAGE_KEY, ids.inverterSerial);
      else localStorage.removeItem(INVERTER_SERIAL_STORAGE_KEY);
      if (ids?.evChargerId) localStorage.setItem(EV_CHARGER_ID_STORAGE_KEY, ids.evChargerId);
      else localStorage.removeItem(EV_CHARGER_ID_STORAGE_KEY);

    } catch (error: any) {
      console.error("Failed to fetch device IDs:", error);
      setDeviceIDsError(error.message || "Failed to retrieve device identifiers.");
      setDeviceIDs(null); // Clear device IDs on fetch error
      setInverterSerial(null); // Clear state on fetch error
      setEvChargerId(null); // Clear state on fetch error

      // Also clear from local storage on fetch error to avoid displaying stale data
      localStorage.removeItem(INVERTER_SERIAL_STORAGE_KEY);
      localStorage.removeItem(EV_CHARGER_ID_STORAGE_KEY);

    } finally {
      setIsDeviceIDsLoading(false); // Always set to false after fetch attempt
    }
  }, [inverterSerial, evChargerId]); // Add inverterSerial and evChargerId as dependencies

  const saveApiKey = useCallback(async (key: string) => {
    setIsProcessingNewKey(true);
    setDeviceIDsError(null);
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      setApiKey(key); // This state update might trigger the useEffect below
      await fetchAndSetDeviceIDs(key); // Explicitly call and await
    } catch (error: any) {
      console.error("Failed to save API key or fetch IDs:", error);
      setDeviceIDsError(error.message || "Error saving API key or fetching identifiers.");
      throw error; // Re-throw to be caught by ApiKeyForm's handler
    } finally {
      setIsProcessingNewKey(false);
    }
  }, [fetchAndSetDeviceIDs]);

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      setApiKey(null);
      setDeviceIDs(null);
      setInverterSerial(null); // Clear state
      setEvChargerId(null); // Clear state
      localStorage.removeItem(INVERTER_SERIAL_STORAGE_KEY);
      localStorage.removeItem(EV_CHARGER_ID_STORAGE_KEY); // Use correct key
 setDeviceIDsError(null);
    } catch (error) {
      console.error("Failed to remove API key from localStorage:", error);
    }
  }, []);

  const exportApiKey = useCallback(() => {
    if (!apiKey) return;
    const blob = new Blob([JSON.stringify({ apiKey })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "helios-control-api-key.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [apiKey]);

  const importApiKey = useCallback(async (file: File): Promise<void> => {
    setIsProcessingNewKey(true);
    setDeviceIDsError(null);
    return new Promise<void>(async (resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const result = event.target?.result;
          if (typeof result === "string") {
            const parsed = JSON.parse(result);
            if (parsed.apiKey && typeof parsed.apiKey === "string") {
              localStorage.setItem(API_KEY_STORAGE_KEY, parsed.apiKey);
              setApiKey(parsed.apiKey); // This state update might trigger the useEffect below
              await fetchAndSetDeviceIDs(parsed.apiKey); // Explicitly call and await
              resolve();
            } else {
              reject(new Error("Invalid API key file format."));
            }
          } else {
            reject(new Error("Failed to read file content."));
          }
        } catch (error: any) {
          console.error("Error importing API key or fetching IDs:", error);
          setDeviceIDsError(error.message || "Error processing API key file during ID fetch.");
          reject(error);
        }
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        reject(new Error("Could not read the file.\nEnsure the file is a valid JSON export from Helios Control.")); // Provide more helpful error
      };
      reader.readAsText(file);
    }).finally(() => {
        setIsProcessingNewKey(false);
    });
  }, [fetchAndSetDeviceIDs]);

  // Effect to fetch device IDs if API key is available and IDs are not yet loaded
  useEffect(() => {
    // Only fetch if API key is available, initial API key load is complete,
    // not currently processing a new key, and device IDs are not already loaded.
    if (apiKey && !isLoadingApiKey && !isProcessingNewKey && (!inverterSerial && !evChargerId)) {
        fetchAndSetDeviceIDs(apiKey);
    }
  }, [apiKey, isLoadingApiKey, isProcessingNewKey, inverterSerial, evChargerId, fetchAndSetDeviceIDs]);


  return {
    apiKey,
    saveApiKey,
    clearApiKey,
    isLoadingApiKey, // Export API key loading state
    exportApiKey,
    importApiKey,
    deviceIDs,
    isDeviceIDsLoading, // Loading of device IDs specifically (includes initial local storage check and API fetch)
    deviceIDsError,
    fetchAndSetDeviceIDs,
    isProcessingNewKey, // True when saveApiKey or importApiKey is in progress
    inverterSerial, // Expose locally stored serial
    evChargerId // Expose locally stored EV charger ID
  };
}
