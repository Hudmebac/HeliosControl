
"use client"

import { useTheme } from "@/hooks/use-theme";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useTheme(); // This hook handles applying the theme
  return <>{children}</>;
}
