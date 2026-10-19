"use client";

import { useEffect, useState, type ComponentType } from "react";

type HomeProps = { bankId: string; onNavigate: (tab: string) => void };

/** Reuse upstream data, translations and controls; only the panel layout changes. */
export function withHomePanels(UpstreamHome: ComponentType<HomeProps>) {
  return function WarmGlassHome(props: HomeProps) {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      let cancelled = false;
      void import("./panels.css").then(() => {
        if (!cancelled) setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }, []);
    return (
      <div data-home-layout={ready ? "warm-glass" : undefined}>
        <UpstreamHome {...props} />
      </div>
    );
  };
}
