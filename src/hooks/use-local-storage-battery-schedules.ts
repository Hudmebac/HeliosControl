
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { NamedPreset, PresetSettings, InverterPresetId } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// Note: This hook now manages all "presets", not just battery schedules, to align with the new API.
// The name is kept for now to avoid breaking imports, but the internal logic is preset-based.
const LOCAL_STORAGE_KEY_PREFIX = 'helios-preset-schedules-';

export function useLocalStorageBatterySchedules(inverterSerial: string | null) {
  const getStorageKey = useCallback(() => {
    return inverterSerial ? `${LOCAL_STORAGE_KEY_PREFIX}${inverterSerial}` : null;
  }, [inverterSerial]);

  const [presets, setPresets] = useState<NamedPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPresetsFromStorage = useCallback(() => {
    setIsLoading(true);
    const storageKey = getStorageKey();
    if (!storageKey) {
      setPresets([]);
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: NamedPreset[] = JSON.parse(stored);
        setPresets(parsed);
      } else {
        setPresets([]);
      }
    } catch (error) {
      console.error("Error loading presets from localStorage:", error);
      setPresets([]);
    } finally {
      setIsLoading(false);
    }
  }, [getStorageKey]);

  useEffect(() => {
    loadPresetsFromStorage();
  }, [inverterSerial, loadPresetsFromStorage]);

  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey && !isLoading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(presets));
      } catch (error) {
        console.error("Error saving presets to localStorage:", error);
      }
    }
  }, [presets, inverterSerial, isLoading, getStorageKey]);

  const addPreset = useCallback((presetData: { name: string, presetId: InverterPresetId, settings: PresetSettings }): NamedPreset => {
    const newPreset: NamedPreset = {
      ...presetData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPresets(prev => [newPreset, ...prev]);
    return newPreset;
  }, []);

  const updatePreset = useCallback((presetId: string, updates: { name: string, settings: PresetSettings }) => {
    setPresets(prev =>
      prev.map(p =>
        p.id === presetId
          ? { ...p, name: updates.name, settings: updates.settings, updatedAt: new Date().toISOString() }
          : p
      )
    );
  }, []);

  const deletePreset = useCallback((presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
  }, []);

  return {
    presets,
    addPreset,
    updatePreset,
    deletePreset,
    isLoading,
    reloadPresets: loadPresetsFromStorage,
  };
}
