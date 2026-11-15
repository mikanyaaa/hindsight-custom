"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore } from "react";
// CUSTOM-HOOK: theme-quiet-paper-persist begin
import {
  THEME_STORAGE_KEY,
  readResolvedTheme,
  themeCookieValue,
  type ThemeMode,
} from "@/custom/theme/init";
// CUSTOM-HOOK: theme-quiet-paper-persist end

type Theme = ThemeMode;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage can be blocked; the class and cookie still apply for this load */
  }
  document.cookie = themeCookieValue(theme);
  emit();
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const theme = useSyncExternalStore(subscribe, readResolvedTheme, () => initialTheme);

  // The class is owned by the blocking script and by explicit choices.
  // This re-applies it after hydration without taking the server snapshot's word.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", readResolvedTheme() === "dark");
    let explicit: string | null = null;
    try {
      explicit = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      explicit = null;
    }
    if (explicit === "light" || explicit === "dark") {
      document.cookie = themeCookieValue(explicit);
    }
  }, [theme]);

  const toggleTheme = () => {
    applyTheme(theme === "light" ? "dark" : "light");
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
