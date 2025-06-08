
"use client"

import { Moon, Sun, Contrast, Laptop } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Theme } from "@/lib/types";

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme();

  const themes: {value: Theme, label: string, icon: React.ReactNode}[] = [
    { value: "light", label: "Light", icon: <Sun className="mr-2 h-4 w-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="mr-2 h-4 w-4" /> },
    { value: "hc-light", label: "High Contrast Light", icon: <Contrast className="mr-2 h-4 w-4" /> },
    { value: "hc-dark", label: "High Contrast Dark", icon: <Contrast className="mr-2 h-4 w-4" /> },
    { value: "system", label: "System", icon: <Laptop className="mr-2 h-4 w-4" /> },
  ];

  const currentThemeIcon = () => {
    switch(theme) {
      case 'light': return <Sun className="h-5 w-5" />;
      case 'dark': return <Moon className="h-5 w-5" />;
      case 'hc-light':
      case 'hc-dark': return <Contrast className="h-5 w-5" />;
      case 'system': return <Laptop className="h-5 w-5" />;
      default: return <Sun className="h-5 w-5" />;
    }
  }


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          {currentThemeIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((t) => (
          <DropdownMenuItem key={t.value} onClick={() => setTheme(t.value)} className="cursor-pointer">
            {t.icon}
            <span>{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
