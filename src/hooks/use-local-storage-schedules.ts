
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
        // Order is now preserved from localStorage, no default sort here
        setSchedules(parsedSchedules);
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error("Error loading schedules from localStorage:", error);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  useEffect(() => {
    loadSchedulesFromStorage();
  }, [chargerId, loadSchedulesFromStorage]);

  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && !isLoading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(schedules));
      } catch (error) {
        console.error("Error saving schedules to localStorage:", error);
      }
    }
  }, [schedules, chargerId, isLoading, getStorageKey]);

  const addSchedule = useCallback((scheduleData: Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'>): { type: 'added' | 'updated', id: string } => {
    let updatedScheduleId = '';
    let operationType: 'added' | 'updated' = 'added';

    setSchedules(prevSchedules => {
      const existingScheduleIndex = prevSchedules.findIndex(s => s.name === scheduleData.name);
      let newSchedules = [...prevSchedules];

      if (existingScheduleIndex !== -1) {
        const existingSchedule = newSchedules[existingScheduleIndex];
        newSchedules[existingScheduleIndex] = {
          ...existingSchedule,
          ...scheduleData,
          rules: scheduleData.rules, // Ensure rules are always updated
          // isLocallyActive: scheduleData.isLocallyActive, // This property is no longer directly managed here
          updatedAt: new Date().toISOString(),
        };
        updatedScheduleId = existingSchedule.id;
        operationType = 'updated';
      } else {
        const newSchedule: NamedEVChargerSchedule = {
          ...scheduleData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        // Add new schedules to the top of the list by default, user can reorder
        newSchedules = [newSchedule, ...newSchedules];
        updatedScheduleId = newSchedule.id;
        operationType = 'added';
      }
      // Order is preserved, no sort here
      return newSchedules;
    });
    return { type: operationType, id: updatedScheduleId };
  }, []);

  const updateSchedule = useCallback((scheduleId: string, updates: Partial<Omit<NamedEVChargerSchedule, 'id' | 'createdAt' | 'updatedAt'>>) => {
    setSchedules(prevSchedules =>
      prevSchedules.map(schedule =>
        schedule.id === scheduleId
          ? { ...schedule, ...updates, rules: updates.rules || schedule.rules, updatedAt: new Date().toISOString() }
          : schedule
      )
      // Order is preserved, no sort here
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

  const moveSchedule = useCallback((scheduleId: string, direction: 'up' | 'down') => {
    setSchedules(prevSchedules => {
      const index = prevSchedules.findIndex(s => s.id === scheduleId);
      if (index === -1) return prevSchedules;

      const newSchedules = [...prevSchedules];
      const item = newSchedules.splice(index, 1)[0];

      if (direction === 'up') {
        if (index > 0) {
          newSchedules.splice(index - 1, 0, item);
        } else {
          // Already at the top, put it back
          newSchedules.splice(index, 0, item);
        }
      } else { // direction === 'down'
        if (index < newSchedules.length) { // Note: newSchedules.length because item was already removed
          newSchedules.splice(index + 1, 0, item);
        } else {
          // Already at the bottom, put it back
          newSchedules.splice(index, 0, item);
        }
      }
      return newSchedules;
    });
  }, []);

  const moveScheduleUp = useCallback((scheduleId: string) => {
    moveSchedule(scheduleId, 'up');
  }, [moveSchedule]);

  const moveScheduleDown = useCallback((scheduleId: string) => {
    moveSchedule(scheduleId, 'down');
  }, [moveSchedule]);


  return {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getSchedule,
    isLoading,
    reloadSchedules: loadSchedulesFromStorage,
    moveScheduleUp,
    moveScheduleDown,
  };
}
