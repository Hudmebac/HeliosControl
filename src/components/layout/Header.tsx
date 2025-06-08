
"use client";

import { AppLogo } from "@/components/layout/AppLogo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsSheetContent } from "@/components/settings/SettingsSheetContent";
import { appEventBus, REFRESH_DASHBOARD_EVENT } from "@/lib/event-bus";
import { useGivEnergyData } from "@/hooks/use-giv-energy-data"; // To access isLoading state
import { useApiKey } from "@/hooks/use-api-key"; // To check if API key is set
import { useState, useEffect } from "react";


export function Header() {
  const { apiKey } = useApiKey();
  // We need a local loading state for the refresh button,
  // as the global isLoading from useGivEnergyData might be true for auto-refresh too.
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // This effect is a bit of a workaround to "observe" the global loading state
  // from useGivEnergyData. A more robust solution might involve a shared state/context
  // for the "manual refresh in progress" specifically.
  // For now, we assume if apiKey exists and a refresh is triggered, we manage our own button state.
  
  const handleRefresh = () => {
    if (!apiKey || isManualRefreshing) return;

    setIsManualRefreshing(true);
    appEventBus.emit(REFRESH_DASHBOARD_EVENT);
    
    // Simulate the refresh duration for button state.
    // Ideally, the event bus or a callback would signal completion.
    // This is a simplification.
    setTimeout(() => {
      setIsManualRefreshing(false);
    }, 2000); // Reset after 2 seconds, adjust as needed
  };


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <AppLogo className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-lg font-semibold font-headline">Helios Control</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
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
