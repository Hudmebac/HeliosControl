
"use client"

import type { Theme } from "@/lib/types";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "helios-control-theme";

// Define theme colors (Moved from EVChargerPage.tsx)
export const themes = {
  light: {
    primary: '#FFA500', // Orange
    secondary: '#FFFFFF', // White
    accent: '#C0C0C0', // Silver
    text: '#000000', // Black
  },
  dark: {
    primary: '#FFA500', // Orange
    secondary: '#000000', // Black
    accent: '#C0C0C0', // Silver
    text: '#FFFFFF', // White
  },
  'high-contrast-light': {
    primary: '#FF4500', // OrangeRed
    secondary: '#FFFFFF', // White
    accent: '#000000', // Black
    text: '#000000', // Black
  },
  'high-contrast-dark': {
    primary: '#FF4500', // OrangeRed
    secondary: '#000000', // Black
    accent: '#FFFF00', // Yellow
    text: '#FFFFFF', // White
  },
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);
 
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "hc-light", "hc-dark");

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    
    root.classList.add(effectiveTheme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]); // Apply theme whenever the theme state changes

  useEffect(() => {
    // Set mounted to true once the component is mounted on the client side
    setMounted(true);
    // Read initial theme from local storage
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (storedTheme) {
      setThemeState(storedTheme);
    }
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme, mounted };
}
