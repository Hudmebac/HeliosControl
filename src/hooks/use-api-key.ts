
"use client"

import { useState, useEffect, useCallback } from "react";
import { getDeviceIDs } from "@/lib/givenergy";
import type { GivEnergyIDs } from "@/lib/types";

const API_KEY_STORAGE_KEY = "helios-control-api-key";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial key load from localStorage
  const [deviceIDs, setDeviceIDs] = useState<GivEnergyIDs | null>(null);
  const [isDeviceIDsLoading, setIsDeviceIDsLoading] = useState(false);
  const [deviceIDsError, setDeviceIDsError] = useState<string | null>(null);
  const [isProcessingNewKey, setIsProcessingNewKey] = useState(false); // For save/import operations

  useEffect(() => {
    try {
      const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    } catch (error) {
      console.error("Failed to load API key from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAndSetDeviceIDs = useCallback(async (currentApiKey: string) => {
    if (!currentApiKey) {
      setDeviceIDs(null);
      setDeviceIDsError(null);
      return;
    }
    setIsDeviceIDsLoading(true);
    setDeviceIDsError(null);
    try {
      const ids = await getDeviceIDs(currentApiKey);
      setDeviceIDs(ids);
    } catch (error: any) {
      console.error("Failed to fetch device IDs:", error);
      setDeviceIDsError(error.message || "Failed to retrieve device identifiers.");
      setDeviceIDs(null);
    } finally {
      setIsDeviceIDsLoading(false);
    }
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    setIsProcessingNewKey(true);
    setDeviceIDsError(null);
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      setApiKey(key); // This state update will trigger the useEffect below for fetching IDs
      await fetchAndSetDeviceIDs(key); // Explicitly call and await
    } catch (error: any) {
      console.error("Failed to save API key or fetch IDs:", error);
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
              setApiKey(parsed.apiKey); // This state update will trigger the useEffect below
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
        reject(new Error("Could not read the file."));
      };
      reader.readAsText(file);
    }).finally(() => {
        setIsProcessingNewKey(false);
    });
  }, [fetchAndSetDeviceIDs]);

  // Fetch device IDs if API key is loaded from localStorage on initial mount or changes
  useEffect(() => {
    if (apiKey && !isLoading && !isProcessingNewKey) {
      // Avoid fetching if a save/import process is already running
      // Also ensure initial loading from storage is done
      fetchAndSetDeviceIDs(apiKey);
    }
  }, [apiKey, isLoading, isProcessingNewKey, fetchAndSetDeviceIDs]);

  return { 
    apiKey, 
    saveApiKey, 
    clearApiKey, 
    isLoading, // Initial loading of key from storage
    exportApiKey, 
    importApiKey, 
    deviceIDs, 
    isDeviceIDsLoading, // Loading of device IDs specifically
    deviceIDsError, 
    fetchAndSetDeviceIDs,
    isProcessingNewKey // True when saveApiKey or importApiKey is in progress
  };
}
