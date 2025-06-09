
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SettingsSheetContent } from "@/components/settings/SettingsSheetContent";
import { useAppSettings } from "@/hooks/use-app-settings";
import { ApiKeyForm } from "@/components/api/ApiKeyForm";
import { useApiKey } from "@/hooks/use-api-key";
import { Loader2, ShieldCheck, AlertTriangle, Info } from "lucide-react";

// Note: The AccountCard defined here is specific to this file and different from src/components/account/AccountCard.tsx
export function AccountCard() {
  const { isSettingsOpen, setIsSettingsOpen } = useAppSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Manage your account settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AuthenticationArea /> {/* Uses AuthenticationArea defined below in the same module */}
        <Separator />
        {/* Temporarily disabled */}
        {/* <SettingsSheetContent open={isSettingsOpen} onOpenChange={setIsSettingsOpen} /> */}
      </CardContent>
    </Card>
  );
}

export function AuthenticationArea() {
  const { apiKey, deviceIDs, isDeviceIDsLoading, deviceIDsError, isLoading: isApiKeyHookLoading } = useApiKey();

  const showDeviceIDsSection = apiKey && !isApiKeyHookLoading;
  const showLoadingForIDs = isDeviceIDsLoading && !deviceIDsError;
  const showDeviceIDError = deviceIDsError && !isDeviceIDsLoading;
  const showDeviceIDData = !isDeviceIDsLoading && !deviceIDsError && deviceIDs;
  const showNoDeviceIDData = !isDeviceIDsLoading && !deviceIDsError && !deviceIDs && apiKey;


  return (
    <Card className="border-none shadow-none">
      <CardHeader className="pt-0">
        <CardTitle className="flex items-center text-lg">
          <ShieldCheck className="mr-2 h-5 w-5" />
          API Key & System Identifiers
        </CardTitle>
        <CardDescription>
          Manage your GivEnergy API key and view connected system identifiers. Your API key is stored locally in your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ApiKeyForm />
        {showDeviceIDsSection && (
          <>
            <Separator />
            <div>
              <h3 className="text-md font-semibold mb-3">System Identifiers</h3>
              {showLoadingForIDs && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading system identifiers...</span>
                </div>
              )}
              {showDeviceIDError && (
                 <div className="flex items-start space-x-2 text-sm text-destructive p-3 border border-destructive/50 bg-destructive/10 rounded-md">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="break-all">Error fetching IDs: {deviceIDsError}</span>
                </div>
              )}
              {showDeviceIDData && (
                <div className="p-3 bg-muted/50 rounded-md space-y-2">
                  <div className="flex items-center">
                    <Info className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">Inverter Serial:</span>
                    <span className="ml-2 text-sm text-foreground truncate">{deviceIDs?.inverterSerial || "Not found"}</span>
                  </div>
                  <div className="flex items-center">
                    <Info className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">EV Charger ID:</span>
                    <span className="ml-2 text-sm text-foreground truncate">{deviceIDs?.evChargerId || "Not available / Not found"}</span>
                  </div>
                </div>
              )}
               {showNoDeviceIDData && (
                 <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">No device identifiers found. This could be due to an API key issue, no devices registered, or an error during retrieval.</p>
               )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
