import { describe, expect, it } from "vitest";

import { isPublicAppPath } from "@/custom/auth/public-paths";

describe("isPublicAppPath", () => {
  it.each(["/login", "/api/health", "/api/version", "/api/auth", "/api/auth/login", "/_next/static/chunk.js"])(
    "allows %s",
    (path) => {
      expect(isPublicAppPath(path)).toBe(true);
    }
  );

  it.each(["/healthXYZ", "/api/healthXYZ", "/api/health/extra", "/api/public-evil", "/login-evil", "/api/auth-evil"])(
    "rejects %s",
    (path) => {
      expect(isPublicAppPath(path)).toBe(false);
    }
  );
});
