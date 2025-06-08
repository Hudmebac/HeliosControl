
"use client"

import { useApiKey } from "@/hooks/use-api-key";
import { ApiKeyForm } from "@/components/api/ApiKeyForm";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { apiKey, isLoading: isApiKeyLoading, saveApiKey } = useApiKey();

  const handleApiKeySet = () => {
    // This function is called after API key is successfully set by ApiKeyForm
    // We don't need to call saveApiKey here again as ApiKeyForm handles it.
    // The component will re-render due to apiKey state change in useApiKey hook.
  };

  if (isApiKeyLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Helios Control...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {!apiKey ? (
        <ApiKeyForm onApiKeySet={handleApiKeySet} />
      ) : (
        <DashboardGrid apiKey={apiKey} />
      )}
    </div>
  );
}
