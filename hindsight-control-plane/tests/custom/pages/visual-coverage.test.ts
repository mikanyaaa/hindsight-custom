import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FRAME_NAV } from "@/custom/frame/nav";

const script = readFileSync(join(__dirname, "visual.cjs"), "utf8");
const workflows = join(__dirname, "../../../../.github/workflows");

describe("visual regression coverage", () => {
  it("visits every frame page plus the bank list and the login page", () => {
    for (const item of FRAME_NAV) {
      expect(script).toContain(`view=${item.id}`);
    }
    expect(script).toContain('path: "/en/dashboard"');
    expect(script).toContain('path: "/en/login"');
    expect(script).toContain("width: 390");
    expect(script).toContain("width: 1440");
    expect(script).toContain('"light", "dark"');
  });

  it("stays a local script", () => {
    expect(script).toContain("not run from GitHub Actions");
    for (const name of readdirSync(workflows)) {
      if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
      const text = readFileSync(join(workflows, name), "utf8");
      expect(text).not.toContain("visual.cjs");
      expect(text).not.toContain("test:visual");
    }
  });
});
