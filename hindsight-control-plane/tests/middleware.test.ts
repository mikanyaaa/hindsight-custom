import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { ACCESS_KEY_COOKIE, createSessionToken } from "@/lib/auth/session";

// The real i18n middleware can't load under vitest; locale rewriting isn't what's tested.
vi.mock("next-intl/middleware", () => ({ default: () => () => NextResponse.next() }));

const KEY = "test-access-key";

async function request(path: string, withSession: boolean) {
  const req = new NextRequest(new URL(path, "http://localhost:9999"));
  if (withSession) req.cookies.set(ACCESS_KEY_COOKIE, await createSessionToken(KEY));
  return middleware(req);
}

describe("middleware session handling", () => {
  beforeEach(() => vi.stubEnv("HINDSIGHT_CP_ACCESS_KEY", KEY));
  afterEach(() => vi.unstubAllEnvs());

  it("marks its own 401 so the browser knows to log in again", async () => {
    const res = await request("/api/banks", false);
    expect(res.status).toBe(401);
    expect(res.headers.get("x-hindsight-session-required")).toBe("1");
  });

  it("sends a signed-in visit to /login on to its returnTo", async () => {
    const res = await request("/login?returnTo=%2Fbanks%2Fa", true);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:9999/banks/a");
  });

  it("never follows an off-site returnTo", async () => {
    const res = await request("/login?returnTo=%2F%2Fevil.com", true);
    expect(res.headers.get("location")).toBe("http://localhost:9999/dashboard");
  });

  it("still shows the login form without a valid session", async () => {
    const res = await request("/login", false);
    expect(res.headers.get("location")).toBeNull();
  });

  it.each(["/api/healthXYZ", "/api/health/extra", "/api/auth-evil"])(
    "does not treat %s as a public API path",
    async (path) => {
      const res = await request(path, false);
      expect(res.status).toBe(401);
    }
  );

  it.each(["/login-evil", "/favicon-evil"])(
    "does not treat %s as a public page",
    async (path) => {
      const res = await request(path, false);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    }
  );

  it("allows the health route and a real auth subpath", async () => {
    expect((await request("/api/health", false)).status).not.toBe(401);
    expect((await request("/api/auth/login", false)).status).not.toBe(401);
  });
});

describe("middleware without an access key", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses a protected route and names the missing variable", async () => {
    vi.stubEnv("HINDSIGHT_CP_ACCESS_KEY", "   ");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request("/api/banks", false);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "Access key not configured" });
    const logged = error.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("HINDSIGHT_CP_ACCESS_KEY");
    expect(logged).not.toContain("super-secret");
    error.mockRestore();
  });

  it("keeps the public health route available", async () => {
    vi.stubEnv("HINDSIGHT_CP_ACCESS_KEY", "");
    const res = await request("/api/health", false);
    expect(res.status).not.toBe(503);
  });

  it("allows protected routes when the local opt-out is set", async () => {
    vi.stubEnv("HINDSIGHT_CP_ACCESS_KEY", "");
    vi.stubEnv("HINDSIGHT_CP_ALLOW_UNAUTHENTICATED", "true");
    const res = await request("/api/banks", false);
    expect(res.status).not.toBe(503);
    expect(res.status).not.toBe(401);
  });
});
