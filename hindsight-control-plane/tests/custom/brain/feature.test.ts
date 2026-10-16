import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each([undefined, "false", "TRUE", " true", "true ", "1", "true"])(
  "enables the build flag only for exact true (%s)",
  async (value) => {
    vi.stubEnv("NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED", value);
    vi.resetModules();
    const { BRAIN_ENABLED } = await import("@/custom/brain/feature");
    expect(BRAIN_ENABLED).toBe(value === "true");
  }
);
