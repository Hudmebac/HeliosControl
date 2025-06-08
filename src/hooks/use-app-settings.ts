
"use client"

import { useState, useEffect, useCallback } from "react";

const REFRESH_INTERVAL_STORAGE_KEY = "helios-control-refresh-interval";
export const DEFAULT_REFRESH_INTERVAL = 60; // seconds
export const REFRESH_INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 90, 120, 150, 180]; // seconds

export function useAppSettings() {
  const [refreshInterval, setRefreshIntervalState] = useState<number>(DEFAULT_REFRESH_INTERVAL);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const storedInterval = localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY);
      if (storedInterval) {
        const parsedInterval = parseInt(storedInterval, 10);
        if (REFRESH_INTERVAL_OPTIONS.includes(parsedInterval)) {
          setRefreshIntervalState(parsedInterval);
        } else {
          localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(DEFAULT_REFRESH_INTERVAL));
        }
      } else {
         localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(DEFAULT_REFRESH_INTERVAL));
      }
    } catch (error) {
      console.error("Failed to load refresh interval from localStorage:", error);
      // Set to default if localStorage access fails or value is corrupted
      localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(DEFAULT_REFRESH_INTERVAL));
      setRefreshIntervalState(DEFAULT_REFRESH_INTERVAL);
    }
  }, []);

  const setRefreshInterval = useCallback((newInterval: number) => {
    if (REFRESH_INTERVAL_OPTIONS.includes(newInterval)) {
      try {
        localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(newInterval));
        setRefreshIntervalState(newInterval);
      } catch (error) {
        console.error("Failed to save refresh interval to localStorage:", error);
      }
    } else {
      console.warn(`Attempted to set invalid refresh interval: ${newInterval}`);
    }
  }, []);

  return { 
    refreshInterval: isMounted ? refreshInterval : DEFAULT_REFRESH_INTERVAL, // Return default until mounted to avoid hydration issues
    setRefreshInterval,
    refreshIntervalOptions: REFRESH_INTERVAL_OPTIONS,
    isSettingsLoaded: isMounted,
  };
}
