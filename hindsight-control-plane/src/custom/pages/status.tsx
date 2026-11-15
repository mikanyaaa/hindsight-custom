"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getGuardState, subscribeGuard, type GuardState } from "@/custom/client-guard/state";
import { pageCopyFor } from "@/custom/pages/copy";

/** Centered wait. The label defaults to the shared "Loading" line. */
export function PageLoading({ label }: { label?: string }) {
  const copy = pageCopyFor(useLocale());
  return (
    <div className="flex min-h-48 items-center justify-center py-16" role="status">
      <div className="text-center">
        <div aria-hidden="true">
          <Spinner size="lg" variant="jump" className="mx-auto mb-3" />
        </div>
        <p className="text-sm text-muted-foreground">{label ?? copy.loading}</p>
      </div>
    </div>
  );
}

/** The quiet empty panel. The sentence is the page's own, not a shared one. */
export function PageEmpty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <div className="max-w-md">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * A failed load. While the session dialog or the timeout banner is up, this
 * renders nothing: those two already explain the failure, and a second panel
 * would read as "Network Error" on top of "Sitzung abgelaufen".
 */
export function PageError({ onRetry }: { onRetry: () => void }) {
  const copy = pageCopyFor(useLocale());
  const [guard, setGuard] = useState<GuardState>(getGuardState);
  useEffect(() => subscribeGuard(setGuard), []);
  if (guard.kind !== "idle") return null;
  return (
    <div
      role="alert"
      className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card px-6 py-16 text-center"
    >
      <div className="max-w-md">
        <p className="text-sm font-medium text-foreground">{copy.errorTitle}</p>
        <Button type="button" className="mt-4" onClick={onRetry}>
          {copy.retry}
        </Button>
      </div>
    </div>
  );
}
