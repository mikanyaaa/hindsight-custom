/**
 * Paths that skip the control-plane session check.
 *
 * Matching is exact, or a directory prefix that ends at a path segment.
 * `startsWith("/api/health")` would also allow `/api/healthXYZ`.
 */

const PUBLIC_EXACT = new Set([
  "/login",
  "/api/auth",
  "/api/health",
  "/api/version",
  "/logo.png",
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/manifest.json",
]);

/** Prefixes include the trailing slash so the next character is a new segment. */
const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/fonts/", "/static/"];

export function isPublicAppPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
