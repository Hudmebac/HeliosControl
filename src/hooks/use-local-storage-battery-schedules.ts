
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { NamedBatterySchedule, BatteryScheduleSettings } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

const LOCAL_STORAGE_KEY_PREFIX = 'helios-battery-schedules-';

export function useLocalStorageBatterySchedules(inverterSerial: string | null) {
  const getStorageKey = useCallback(() => {
    return inverterSerial ? `${LOCAL_STORAGE_KEY_PREFIX}${inverterSerial}` : null;
  }, [inverterSerial]);

  const [schedules, setSchedules] = useState<NamedBatterySchedule[]>([]);
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
        const parsedSchedules: NamedBatterySchedule[] = JSON.parse(storedSchedules);
        setSchedules(parsedSchedules);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error("Error loading battery schedules from localStorage:", error);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  useEffect(() => {
    loadSchedulesFromStorage();
  }, [inverterSerial, loadSchedulesFromStorage]);

  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && !isLoading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(schedules));
      } catch (error) {
        console.error("Error saving battery schedules to localStorage:", error);
      }
    }
  }, [schedules, inverterSerial, isLoading, getStorageKey]);

  const addSchedule = useCallback((scheduleData: { name: string, settings: BatteryScheduleSettings }): NamedBatterySchedule => {
    const newSchedule: NamedBatterySchedule = {
      ...scheduleData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSchedules(prevSchedules => [newSchedule, ...prevSchedules]);
    return newSchedule;
  }, []);

  const updateSchedule = useCallback((scheduleId: string, updates: { name: string, settings: BatteryScheduleSettings }) => {
    setSchedules(prevSchedules =>
      prevSchedules.map(schedule =>
        schedule.id === scheduleId
          ? { ...schedule, name: updates.name, settings: updates.settings, updatedAt: new Date().toISOString() }
          : schedule
      )
    );
  }, []);

  const deleteSchedule = useCallback((scheduleId: string) => {
    setSchedules(prevSchedules =>
      prevSchedules.filter(schedule => schedule.id !== scheduleId)
    );
  }, []);

  return {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    isLoading,
    reloadSchedules: loadSchedulesFromStorage,
  };
}
