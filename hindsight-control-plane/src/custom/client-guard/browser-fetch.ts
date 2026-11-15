import { isSessionExpiredResponse } from "./detect";
import { reportSessionExpired } from "./state";

/** UI data fetches give up after this long and show a retry state. */
export const UI_FETCH_TIMEOUT_MS = 20_000;

export class SessionExpiredError extends Error {
  constructor() {
    super("session-expired");
    this.name = "SessionExpiredError";
  }
}

export class RequestTimeoutError extends Error {
  constructor() {
    super("request-timeout");
    this.name = "RequestTimeoutError";
  }
}

/**
 * `fetch` for UI data calls.
 *
 * `redirect: "manual"` keeps an upstream login redirect visible (opaqueredirect
 * or a 3xx) instead of following it into an HTML page that then fails JSON
 * parsing and surfaces as a network error. `timeoutMs` aborts via
 * AbortController; a caller-supplied signal still cancels without that timeout.
 */
export async function browserFetch(
  input: string,
  init: RequestInit | undefined,
  timeoutMs: number | null
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init?.signal;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  if (timeoutMs != null) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(input, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    if (isSessionExpiredResponse(response)) {
      reportSessionExpired();
      throw new SessionExpiredError();
    }
    return response;
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    if (timedOut && !callerSignal?.aborted) throw new RequestTimeoutError();
    throw error;
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}
