
"use client"

import { useApiKey } from "@/hooks/use-api-key";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile"; // Import the useIsMobile hook
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
// Using specific Lucide icons for new cards
import { Loader2, AlertCircle, Settings, Sunrise, LineChart, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button"; // Added for potential settings button

export default function HomePage() {
  const { apiKey, isLoading: isApiKeyHookLoading } = useApiKey();
  const isMobile = useIsMobile(); // Use the useIsMobile hook to detect mobile

  if (isApiKeyHookLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading Helios Control...</p>
      </div>
    );
  }

  const handleGivEnergyCloudClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isMobile) {
      event.preventDefault(); // Prevent default navigation
      const appUrl = 'givenergy://'; // Custom URL scheme for GivEnergy app (assumed)
      const storeUrl = 'https://play.google.com/store/apps/details?id=com.mobile.givenergy&utm_source=emea_Med&embedded=0';

      // Attempt to open the app
      window.location.href = appUrl;

      // Set a timer to redirect to the store if the app doesn't open
      // This is a heuristic and might not work perfectly across all devices/browsers
      const timer = setTimeout(() => {
        window.open(storeUrl, '_blank');
      }, 300); // Adjust delay as needed

      // Optional: Clear the timer if the user navigates away (app opens)
      window.addEventListener('blur', () => clearTimeout(timer), { once: true });
    }
  };

  return (
    <div className="w-full space-y-6">
      {apiKey ? (
        <>
          <DashboardGrid apiKey={apiKey} />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/history" passHref>
              <div className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer">
                <LineChart className="h-8 w-8 text-primary mb-3" /> {/* Icon for Energy Flow Data */}
                <h3 className="text-lg font-semibold">Energy Flow Data</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Analyze your historical energy flow and performance.
                </p>
              </div>
            </Link>
            <a href="https://heliosaj.netlify.app/" target="_blank" rel="noopener noreferrer">
              <div className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer">
                <Sunrise className="h-8 w-8 text-primary mb-3" /> {/* Icon for Solar Forecast */}
                <h3 className="text-lg font-semibold">Helios Heggie (Solar Forecast)</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Get a detailed forecast of your solar generation.
                </p>
              </div>
            </a>
            <a
              href={isMobile ? 'https://givenergy.cloud/dashboard' : 'https://givenergy.cloud/dashboard'} // Initial href (will be overridden by onClick)
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleGivEnergyCloudClick}
              data-href-mobile={isMobile ? 'givenergy://' : undefined} // Store potential deep link URL
            >
              <div className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer">
                <img src="https://heliosaj.netlify.app/_next/image?url=%2Fimages%2FGEIcon.webp&w=32&q=75" alt="GivEnergy Icon" className="h-8 w-auto mb-3" /> {/* Image for GivEnergy Cloud */}
                <h3 className="text-lg font-semibold">GivEnergy Cloud</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Access the official GivEnergy Cloud dashboard.
                </p>
              </div>
            </a>
          </div>


        </>
  ) : (
    <Alert variant="default" className="mt-8">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Welcome to Helios Control!</AlertTitle>
      <AlertDescription>
        To get started, please add your GivEnergy API key.
        <br />
        You can do this by clicking the{" "}
        <Settings className="inline-block h-4 w-4 mx-1" /> settings icon in the header.
        <br />
        Once GivEnergy API Key has been saved, please refresh the page to access your dashboard.
      </AlertDescription>
    </Alert>

      )}
    </div>
  );
}
