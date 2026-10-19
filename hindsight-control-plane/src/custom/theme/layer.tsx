"use client";

import { useEffect, type ReactNode } from "react";

/** No wrapper DOM: the disabled build continues to return the upstream tree. */
export default function WarmGlassLayer({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const root = document.documentElement;
    // Loading from an effect keeps the stylesheet out of the critical route CSS.
    void import("./warm-glass.css").then(() => {
      if (cancelled) return;
      root.dataset.themeLayer = "warm-glass";
      const loadBackdrop = () => {
        void import("./assets/lofi-city.webp").then(({ default: asset }) => {
          if (!cancelled) root.style.setProperty("--warm-city", `url("${asset.src}")`);
        });
      };
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(loadBackdrop);
      else timer = setTimeout(loadBackdrop, 200);
    });
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) clearTimeout(timer);
      delete root.dataset.themeLayer;
      root.style.removeProperty("--warm-city");
    };
  }, []);
  return children;
}
