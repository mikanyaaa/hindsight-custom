const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * An upstream access proxy answers an expired session with a redirect or an
 * HTML login page. The control plane's own 401 is JSON and is not this case.
 */
export function isSessionExpiredResponse(
  response: Pick<Response, "status" | "type" | "headers">
): boolean {
  if (response.type === "opaqueredirect" || response.status === 0) return true;
  if (REDIRECT_STATUSES.has(response.status)) return true;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) return false;
  return response.status === 200 || response.status === 401 || response.status === 403;
}
