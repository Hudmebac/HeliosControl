
"use client"

import { useApiKey } from "@/hooks/use-api-key";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { Loader2, AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button"; // Added for potential settings button

export default function HomePage() {
  const { apiKey, isLoading: isApiKeyHookLoading } = useApiKey();

  if (isApiKeyHookLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Helios Control...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {apiKey ? (
        <DashboardGrid apiKey={apiKey} />
      ) : (
         <Alert variant="default" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Welcome to Helios Control!</AlertTitle>
          <AlertDescription>
            To get started, please configure your GivEnergy API key.
            You can do this by clicking the <Settings className="inline-block h-4 w-4 mx-1" /> settings icon in the header.
            Once GivEnergy API Key Saved Refresh page to access Dashboard
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
