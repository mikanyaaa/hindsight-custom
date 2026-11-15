import { RequestTimeoutError, SessionExpiredError } from "@/custom/client-guard/browser-fetch";

/**
 * A cancelled read is not a failure, and an expired session or a timeout
 * already has its own state (the session dialog, the timeout banner).
 * A page should not also say that the list is empty or that the network failed.
 */
export function isPageFailure(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "name" in error) {
    if ((error as { name?: string }).name === "AbortError") return false;
  }
  if (error instanceof SessionExpiredError || error instanceof RequestTimeoutError) return false;
  return true;
}
