
import { AppLogo } from "@/components/layout/AppLogo";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SettingsSheetContent } from "@/components/settings/SettingsSheetContent";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <AppLogo className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-lg font-semibold font-headline">Helios Control</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
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
