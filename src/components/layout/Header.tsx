
"use client";

import { AppLogo } from "@/components/layout/AppLogo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw, Loader2, Timer } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsSheetContent } from "@/components/settings/SettingsSheetContent";
import { appEventBus, REFRESH_DASHBOARD_EVENT, DATA_FETCH_COMPLETED_EVENT } from "@/lib/event-bus";
import { useApiKey } from "@/hooks/use-api-key"; 
import { useAppSettings } from "@/hooks/use-app-settings";
import { useState, useEffect } from "react";


export function Header() {
  const { apiKey } = useApiKey();
  const { refreshInterval, isSettingsLoaded } = useAppSettings();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(refreshInterval);

  // Effect to reset countdown when refreshInterval from settings changes
  useEffect(() => {
    if (isSettingsLoaded) {
      setCountdown(refreshInterval);
    }
  }, [refreshInterval, isSettingsLoaded]);

  // Effect for the countdown timer logic
  useEffect(() => {
    if (!apiKey || !isSettingsLoaded) {
      return;
    }

    if (countdown <= 0) {
      // This simulates the auto-refresh cycle for the timer display
      // The actual data fetch is handled by useGivEnergyData
      setCountdown(refreshInterval); 
      return;
    }

    const timerId = setTimeout(() => {
      setCountdown(prevCountdown => prevCountdown - 1);
    }, 1000);

    return () => clearTimeout(timerId);
  }, [countdown, apiKey, isSettingsLoaded, refreshInterval]);

  // Effect to listen for actual data fetch completions to reset timer
  useEffect(() => {
    const handleDataFetchCompleted = () => {
      if (isSettingsLoaded) {
        setCountdown(refreshInterval);
      }
    };
    appEventBus.on(DATA_FETCH_COMPLETED_EVENT, handleDataFetchCompleted);
    return () => {
      appEventBus.off(DATA_FETCH_COMPLETED_EVENT, handleDataFetchCompleted);
    };
  }, [refreshInterval, isSettingsLoaded]);
  
  const handleRefresh = () => {
    if (!apiKey || isManualRefreshing) return;

    setIsManualRefreshing(true);
    appEventBus.emit(REFRESH_DASHBOARD_EVENT);
    // The DATA_FETCH_COMPLETED_EVENT listener will reset the countdown.
    // We can also optimistically reset it here for immediate UI feedback if desired,
    // but letting the event handle it ensures it's tied to actual fetch completion.
    // For now, we'll rely on the event.

    setTimeout(() => {
      setIsManualRefreshing(false);
    }, 3000); // Reset manual refreshing state after a bit
  };


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <AppLogo className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-lg font-semibold font-headline">Helios Control</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2 md:space-x-4">
          {apiKey && isSettingsLoaded && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              <span>Next: {countdown}s</span>
            </div>
          )}
          {apiKey && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh dashboard"
              onClick={handleRefresh}
              disabled={isManualRefreshing}
            >
              {isManualRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </Button>
          )}
          <ThemeSwitcher />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open application settings">
                <Settings className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SettingsSheetContent />
          </Sheet>
        </div>
      </div>
    </header>
  );
}
