import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(
  new URL("../../../docker/standalone/Dockerfile", import.meta.url),
  "utf8"
);

const build = dockerfile.slice(
  dockerfile.indexOf("FROM node:24-slim AS cp-builder"),
  dockerfile.indexOf("FROM python:3.11-slim AS api-only")
);

describe("control-plane Docker build args", () => {
  it("inlines the opt-in UI flags during next build", () => {
    const nextBuild = build.indexOf("RUN npm exec -- next build");
    expect(nextBuild).toBeGreaterThan(0);
    const beforeBuild = build.slice(0, nextBuild);
    for (const name of [
      "NEXT_PUBLIC_BASE_PATH",
      "NEXT_PUBLIC_HINDSIGHT_THEME_WARM_GLASS",
      "NEXT_PUBLIC_HINDSIGHT_BRAIN_ENABLED",
    ]) {
      expect(beforeBuild).toContain(`ARG ${name}`);
      expect(beforeBuild).toContain(`ENV ${name}=\${${name}}`);
    }
  });
});
