
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useApiKey } from "@/hooks/use-api-key";

export function SettingsSheetContent() {
  const { refreshInterval, setRefreshInterval, refreshIntervalOptions, isSettingsLoaded } = useAppSettings();
  const { inverterSerial, evChargerId } = useApiKey();

  const handleCopyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text);
    } else {
      console.warn('Nothing to copy.');
    }
  };

  return (
    <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Application Settings</SheetTitle>
        <SheetDescription>
          Manage your API key, account details, and application preferences here.
        </SheetDescription>
      </SheetHeader>
      <div className="py-6 space-y-6">
        
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="authentication">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              Authentication
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <AuthenticationArea />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="system-identifiers">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              System Identifiers
            </AccordionTrigger>
            <AccordionContent className="pt-4 space-y-4">
              <div>
                <Label className="font-medium">Inverter Serial Number:</Label>
                <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground break-all">{inverterSerial || 'N/A'}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleCopyToClipboard(inverterSerial)} aria-label="Copy Inverter Serial Number">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator /> {/* Add a separator for better visual separation */}

              <div>
                <Label className="font-medium">EV Charger ID (UUID):</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground break-all">{evChargerId || 'N/A'}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleCopyToClipboard(evChargerId)} aria-label="Copy EV Charger ID (UUID)">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="account-details">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              Account Details
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <AccountCard />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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
