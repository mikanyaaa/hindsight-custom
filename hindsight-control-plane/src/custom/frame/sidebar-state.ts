export const SIDEBAR_COOKIE = "hs-sidebar";
const MAX_AGE = 60 * 60 * 24 * 365;

let collapsed = false;
let loaded = false;
const listeners = new Set<() => void>();

/** Cookie, not localStorage: the server render has to emit the same width
 *  the browser hydrates, or the rail jumps and React discards the markup. */
export function sidebarCollapsedFromCookie(value: string | undefined): boolean {
  return value === "1";
}

function readCookie(): boolean {
  return /(?:^|; )hs-sidebar=1(?:;|$)/.test(document.cookie);
}

function ensureLoaded(): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  collapsed = readCookie();
}

export function subscribeSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function collapsedSnapshot(): boolean {
  ensureLoaded();
  return collapsed;
}

export function setSidebarCollapsed(next: boolean): void {
  collapsed = next;
  loaded = true;
  try {
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`;
  } catch {
    // The in-memory value still applies until the next full load.
  }
  for (const listener of listeners) listener();
}
