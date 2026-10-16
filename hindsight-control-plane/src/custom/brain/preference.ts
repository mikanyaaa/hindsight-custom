"use client";

import { useEffect, useState } from "react";
import { BRAIN_ENABLED, type BrainLayoutMode } from "./feature";

const STORAGE_KEY = "hindsight-brain-layout";

export function useBrainMode() {
  const [mode, setMode] = useState<BrainLayoutMode>("network");
  useEffect(() => {
    if (!BRAIN_ENABLED) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "brain") setMode("brain");
    } catch {
      // Layout remains usable when browser storage is denied.
    }
  }, []);
  return {
    layoutMode: BRAIN_ENABLED ? mode : ("network" as BrainLayoutMode),
    onLayoutModeChange: (next: BrainLayoutMode) => {
      if (!BRAIN_ENABLED) return;
      setMode(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Persist only the mode, never bank IDs or memory data.
      }
    },
  };
}
