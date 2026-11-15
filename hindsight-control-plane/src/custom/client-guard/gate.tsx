"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { guardCopy } from "./messages";
import { getGuardState, subscribeGuard, type GuardState } from "./state";

/**
 * Session-expired and request-timeout states for UI data fetches.
 * Reloading is only from the button, and a second click does nothing.
 */
export function ClientGuard() {
  const locale = useLocale();
  const copy = guardCopy(locale);
  const [guard, setGuard] = useState<GuardState>(getGuardState);
  const reloading = useRef(false);

  useEffect(() => subscribeGuard(setGuard), []);

  if (guard.kind === "idle") return null;

  const reloadOnce = () => {
    if (reloading.current) return;
    reloading.current = true;
    window.location.reload();
  };

  if (guard.kind === "session") {
    return (
      <div
        role="alertdialog"
        aria-labelledby="client-guard-session-title"
        aria-describedby="client-guard-session-body"
        className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4"
      >
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
          <h2 id="client-guard-session-title" className="text-base font-semibold">
            {copy.sessionTitle}
          </h2>
          <p id="client-guard-session-body" className="mt-2 text-sm text-muted-foreground">
            {copy.sessionBody}
          </p>
          <Button type="button" className="mt-4" onClick={reloadOnce}>
            {copy.sessionAction}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-[70] mx-auto flex w-[min(24rem,calc(100vw-2rem))] items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <div>
        <p className="text-sm font-medium">{copy.timeoutTitle}</p>
        <p className="text-sm text-muted-foreground">{copy.timeoutBody}</p>
      </div>
      <Button type="button" variant="outline" onClick={guard.retry}>
        {copy.timeoutAction}
      </Button>
    </div>
  );
}
