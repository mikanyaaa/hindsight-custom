import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { localizeApiErrorPayload } from "@/lib/i18n/api-errors";

export const ACCESS_KEY_ENV = "HINDSIGHT_CP_ACCESS_KEY";
export const ALLOW_UNAUTHENTICATED_ENV = "HINDSIGHT_CP_ALLOW_UNAUTHENTICATED";

const MISSING_KEY_LOG =
  "Refusing protected control-plane routes because HINDSIGHT_CP_ACCESS_KEY is unset. " +
  "Set HINDSIGHT_CP_ALLOW_UNAUTHENTICATED=true for local development.";

let loggedMissingKey = false;

/** The configured access key, or null when it is missing or only whitespace. */
export function configuredAccessKey(): string | null {
  const raw = process.env[ACCESS_KEY_ENV];
  if (!raw || raw.trim() === "") return null;
  return raw;
}

/** Explicit local-dev opt-out. Only the value `true` (any case) counts. */
export function unauthenticatedAccessAllowed(): boolean {
  return process.env[ALLOW_UNAUTHENTICATED_ENV]?.trim().toLowerCase() === "true";
}

function logMissingKeyOnce(): void {
  if (loggedMissingKey) return;
  loggedMissingKey = true;
  // The variable name only — never a value, even when one was set and then cleared.
  console.error(MISSING_KEY_LOG);
}

/** Test helper: logging is once per process, and tests share that process. */
export function resetAccessKeyLogForTests(): void {
  loggedMissingKey = false;
}

export function refuseUnconfigured(request: NextRequest, api: boolean): NextResponse {
  logMissingKeyOnce();
  if (api) {
    return NextResponse.json(
      localizeApiErrorPayload(request, {
        error: "Access key not configured",
        errorKey: "api.errors.auth.accessKeyNotConfigured",
      }),
      { status: 503 }
    );
  }
  return new NextResponse(
    "Control plane authentication is not configured. Set HINDSIGHT_CP_ACCESS_KEY, or HINDSIGHT_CP_ALLOW_UNAUTHENTICATED=true for local development.",
    { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}
