
"use client";

import { AuthenticationArea } from "@/components/auth/AuthenticationArea";
import { AccountCard } from "@/components/account/AccountCard";
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSettings } from "@/hooks/use-app-settings";

export function SettingsSheetContent() {
  const { refreshInterval, setRefreshInterval, refreshIntervalOptions, isSettingsLoaded } = useAppSettings();

  return (
    <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Application Settings</SheetTitle>
        <SheetDescription>
          Manage your API key, account details, and application preferences here.
        </SheetDescription>
      </SheetHeader>
      <div className="py-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-3 text-foreground">Authentication</h3>
          <AuthenticationArea />
        </div>
        <Separator />
        <div>
          <h3 className="text-lg font-semibold mb-3 text-foreground">Account Details</h3>
          <AccountCard />
        </div>
        <Separator />
        <div>
          <h3 className="text-lg font-semibold mb-3 text-foreground">Preferences</h3>
          <div className="space-y-2 p-3 bg-muted/50 rounded-md">
            <Label htmlFor="refresh-interval" className="font-medium">Dashboard Refresh Interval</Label>
            {isSettingsLoaded ? (
              <Select
                value={String(refreshInterval)}
                onValueChange={(value) => setRefreshInterval(Number(value))}
              >
                <SelectTrigger id="refresh-interval" className="w-full">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {refreshIntervalOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-10 w-full bg-background animate-pulse rounded-md" />
            )}
            <p className="text-xs text-muted-foreground">
              How often the dashboard data should automatically refresh.
            </p>
          </div>
        </div>
      </div>
    </SheetContent>
  );
}
