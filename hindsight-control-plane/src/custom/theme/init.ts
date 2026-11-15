export const THEME_STORAGE_KEY = "theme";
export const THEME_COOKIE = "hs-theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemeMode = "light" | "dark";

export function themeFromCookie(value: string | undefined): ThemeMode | null {
  return value === "light" || value === "dark" ? value : null;
}

export function themeCookieValue(theme: ThemeMode): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax`;
}

/** Same order as THEME_INIT_SCRIPT: saved choice, then the cookie, then the OS. */
export function readResolvedTheme(): ThemeMode {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    saved = null;
  }
  if (saved === "light" || saved === "dark") return saved;
  const fromCookie = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)`)
  );
  if (fromCookie) return fromCookie[1] === "dark" ? "dark" : "light";
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/** Blocking inline script. Runs before the body is parsed, so the first paint
 *  already has the .dark class. Keep the branch order identical to readResolvedTheme. */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    var cookieName = ${JSON.stringify(THEME_COOKIE)};
    var maxAge = ${THEME_MAX_AGE};
    var saved = null;
    try { saved = localStorage.getItem(storageKey); } catch (err) {}
    var match = document.cookie.match(new RegExp("(?:^|; )" + cookieName + "=(light|dark)(?:;|$)"));
    var fromCookie = match ? match[1] : null;
    var explicit = saved === "light" || saved === "dark" ? saved : fromCookie;
    var dark = explicit ? explicit === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
    if (explicit && fromCookie !== explicit) {
      document.cookie = cookieName + "=" + explicit + "; Path=/; Max-Age=" + maxAge + "; SameSite=Lax";
    }
  } catch (e) {}
})();`;
