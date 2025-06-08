
"use client"

import { useApiKey } from "@/hooks/use-api-key";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AuthenticationArea } from "@/components/auth/AuthenticationArea";
import { AccountCard } from "@/components/account/AccountCard";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function HomePage() {
  const { apiKey, isLoading: isApiKeyHookLoading, deviceIDsError } = useApiKey();

  if (isApiKeyHookLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Helios Control...</p>
      </div>
    );
  }

  const defaultAccordionValue = !apiKey ? "auth-item" : undefined;

  return (
    <div className="w-full space-y-6">
      <Accordion type="single" collapsible className="w-full" defaultValue={defaultAccordionValue}>
        <AccordionItem value="auth-item">
          <AccordionTrigger className="text-xl font-semibold hover:no-underline focus:no-underline pb-3 pt-1">
            Authentication & System Setup
          </AccordionTrigger>
          <AccordionContent>
            <AuthenticationArea />
          </AccordionContent>
        </AccordionItem>

        {apiKey && (
          <AccordionItem value="account-item">
            <AccordionTrigger className="text-xl font-semibold hover:no-underline focus:no-underline pb-3 pt-1">
                Account Details
            </AccordionTrigger>
            <AccordionContent>
              <AccountCard />
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {apiKey && <DashboardGrid apiKey={apiKey} />}
      
      {!apiKey && !isApiKeyHookLoading && (
         <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>API Key Required</AlertTitle>
          <AlertDescription>
            Please configure your GivEnergy API key in the 'Authentication & System Setup' section above to view your energy dashboard.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
