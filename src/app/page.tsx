
"use client"

import { useState, useEffect } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { Loader2, AlertCircle, Settings, Sunrise, LineChart, Car, Clock, HandCoins, BookUserIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const { apiKey, isLoading: isApiKeyHookLoading } = useApiKey();
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleGivEnergyCloudClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isMobile) {
      event.preventDefault(); // Prevent default navigation
      const appUrl = 'givenergy://'; // Custom URL scheme for GivEnergy app (assumed)
      const storeUrl = 'https://play.google.com/store/apps/details?id=com.mobile.givenergy&utm_source=emea_Med';

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
            <a href="https://heliosaj.netlify.app/" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
                <Sunrise className="h-8 w-8 text-primary mb-3" />
                <h3 className="text-lg font-semibold">Solar Forecast</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Forecast your solar generation (Helios Heggie).
                </p>
            </a>
            
            <Link href="/tariffs" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>            
              <HandCoins className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold">The Financials</h3>
              <p className="text-sm text-muted-foreground text-center">
                View cost and compare electricity tariffs.
              </p>
            </Link>

            <Link href="/ev-charger" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
              <Car className="h-8 w-8 text-primary mb-3" style={{ color: '#ff8c00' }} />
              <h3 className="text-lg font-semibold">EV Charger</h3>
              <p className="text-sm text-muted-foreground text-center">
                Manage and monitor your EV charger.
              </p>
            </Link>
            
            <Link href="/timed-charge" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
              <Clock className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold">Timed Charge</h3>
              <p className="text-sm text-muted-foreground text-center">
                Manage Battery Charge Times.
              </p>
            </Link>

            <Link href="/history" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
              <LineChart className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold">Energy Flow Data</h3>
              <p className="text-sm text-muted-foreground text-center">
                Historical energy flow and performance.
              </p>
            </Link>
            <Link href="/guide" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
              <BookUserIcon className="h-8 w-8 text-primary mb-3" style={{ color: '#ff8c00' }} />
              <h3 className="text-lg font-semibold">Helios Guide</h3>
              <p className="text-sm text-muted-foreground text-center">
              Comprehensive guide.
              </p>
            </Link>

            <Link href="/aj_renewables_info" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
              <img src="https://heliosaj.netlify.app/favicon.ico" alt="AJ Renewables" className="h-12 w-auto mb-" />
              <h3 className="text-lg font-semibold">AJ Renewables</h3>
              <p className="text-sm text-muted-foreground text-center">
                Your Trusted Partner for Renewable Energy Solutions.
              </p>
            </Link>

            <a
              href={'https://givenergy.cloud/dashboard'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={isClient ? handleGivEnergyCloudClick : undefined}
              className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}
            >
              <img src="https://heliosaj.netlify.app/_next/image?url=%2Fimages%2FGEIcon.webp&w=32&q=75" alt="GivEnergy Icon" className="h-8 w-auto mb-3" />
              <h3 className="text-lg font-semibold">GivEnergy </h3>
              <p className="text-sm text-muted-foreground text-center">
                GivEnergy App / Cloud dashboard.
              </p>
            </a>

            <a href="https://www.buymeacoffee.com/your-username" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center rounded-lg border p-6 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer h-48" style={{ borderColor: '#ff8c00' }}>
              <HandCoins className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold">Support This App</h3>
              <p className="text-sm text-muted-foreground text-center">
                If you find Helios useful, consider a donation to support development.
              </p>
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
