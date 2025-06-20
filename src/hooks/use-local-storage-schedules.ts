
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { NamedEVChargerSchedule, EVChargerAPIRule } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

const LOCAL_STORAGE_SCHEDULES_KEY_PREFIX = 'helios-ev-schedules-';

export function useLocalStorageSchedules(chargerId: string | null) {
  const getStorageKey = useCallback(() => {
    return chargerId ? `${LOCAL_STORAGE_SCHEDULES_KEY_PREFIX}${chargerId}` : null;
  }, [chargerId]);

  const [schedules, setSchedules] = useState<NamedEVChargerSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSchedulesFromStorage = useCallback(() => {
    setIsLoading(true);
    const storageKey = getStorageKey();
    if (!storageKey) {
      setSchedules([]);
      setIsLoading(false);
      return;
    }

    try {
      const storedSchedules = localStorage.getItem(storageKey);
      if (storedSchedules) {
        const parsedSchedules: NamedEVChargerSchedule[] = JSON.parse(storedSchedules);
        // Basic validation/migration if needed in future
        setSchedules(parsedSchedules.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error("Error loading schedules from localStorage:", error);
      setSchedules([]); // Reset to empty on error
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  // Load schedules from localStorage on mount and when chargerId changes
  useEffect(() => {
    loadSchedulesFromStorage();
  }, [chargerId, loadSchedulesFromStorage]); // chargerId is implicitly handled by getStorageKey -> loadSchedulesFromStorage

  // Save schedules to localStorage whenever they change
  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && !isLoading) { // Only save if not loading and key is present
      try {
        localStorage.setItem(storageKey, JSON.stringify(schedules));
      } catch (error) {
        console.error("Error saving schedules to localStorage:", error);
      }
    }
  }, [schedules, chargerId, isLoading, getStorageKey]);

  const addSchedule = useCallback((scheduleData: Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSchedule: NamedEVChargerSchedule = {
      ...scheduleData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchedules(prevSchedules => [newSchedule, ...prevSchedules].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const updateSchedule = useCallback((scheduleId: string, updates: Partial<Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'>>) => {
    setSchedules(prevSchedules =>
      prevSchedules.map(schedule =>
        schedule.id === scheduleId
          ? { ...schedule, ...updates, updatedAt: new Date().toISOString() }
          : schedule
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }, []);

  const deleteSchedule = useCallback((scheduleId: string) => {
    setSchedules(prevSchedules =>
      prevSchedules.filter(schedule => schedule.id !== scheduleId)
    );
  }, []);

  const getSchedule = useCallback((scheduleId: string): NamedEVChargerSchedule | undefined => {
    return schedules.find(schedule => schedule.id === scheduleId);
  }, [schedules]);

  return {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedule,
    isLoading,
    reloadSchedules: loadSchedulesFromStorage, // Expose the reload function
  };
}
