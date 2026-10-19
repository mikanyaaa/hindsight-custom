import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function checkHooks(sources: Record<string, string>, register: string) {
  const hooks = new Map<string, string>();
  for (const [file, source] of Object.entries(sources)) {
    const stack: string[] = [];
    for (const occurrence of source.matchAll(/CUSTOM-HOOK\b([^\r\n]*)/g)) {
      const marker = occurrence[1].match(/^:\s+([a-z]+-[a-z0-9-]+)\s+(begin|end)(?=\s|$)/);
      if (!marker) throw new Error(`Malformed or unsupported marker in ${file}`);
      const [, name, phase] = marker;
      if (phase === "begin") {
        if (hooks.has(name)) throw new Error(`Duplicate hook ${name}`);
        hooks.set(name, file);
        stack.push(name);
      } else if (stack.pop() !== name) throw new Error(`Unpaired hook ${name} in ${file}`);
    }
    if (stack.length) throw new Error(`Unclosed hook in ${file}`);
  }
  const registered = new Map<string, string>();
  for (const row of register.split("\n")) {
    const columns = row.split("|").map((column) => column.trim());
    const file = columns[1]?.match(/^`(src\/[^`]+)`$/)?.[1];
    if (!file) continue;
    const names = [...columns[2].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    if (!names.length) throw new Error(`Missing hook names in register for ${file}`);
    for (const name of names) {
      if (!/^[a-z]+-[a-z0-9-]+$/.test(name)) throw new Error(`Unsupported registry entry ${name}`);
      if (registered.has(name)) throw new Error(`Duplicate registry entry ${name}`);
      registered.set(name, file);
    }
  }
  expect([...hooks.entries()].sort()).toEqual([...registered.entries()].sort());
  // Also reject stale hook-name references elsewhere in CUSTOM.md, outside the table.
  for (const [, name] of register.matchAll(/`(brain-[a-z0-9-]+)`/g))
    expect(hooks.has(name), name).toBe(true);
  return hooks;
}

function sourceTree(root: string, relative = "src"): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const name = `${relative}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(sources, sourceTree(join(root, entry.name), name));
    else sources[name] = readFileSync(join(root, entry.name), "utf8");
  }
  return sources;
}

const pair = "// CUSTOM-HOOK: brain-example begin\n// CUSTOM-HOOK: brain-example end";
const row = "| `src/example.ts` | `brain-example` | Test hook |";

describe("CUSTOM.md source hook contract", () => {
  it("scans every file in src and matches the register exactly in both directions", () => {
    const root = fileURLToPath(new URL("../../../src", import.meta.url));
    const register = readFileSync(new URL("../../../../CUSTOM.md", import.meta.url), "utf8");
    const hooks = checkHooks(sourceTree(root), register);
    expect(hooks.size).toBeGreaterThan(0);
    expect(
      [...hooks.values()].filter((file) => file === "src/components/constellation.tsx").length
    ).toBeLessThan(10);
  });
  it("accepts valid paired hooks", () => {
    expect(checkHooks({ "src/example.ts": pair }, row).size).toBe(1);
  });
  it("accepts another explicitly registered namespace", () => {
    expect(
      checkHooks(
        { "src/example.ts": pair.replaceAll("brain-example", "theme-example") },
        row.replaceAll("brain-example", "theme-example")
      ).size
    ).toBe(1);
  });
  it.each([
    pair.replaceAll("brain-example", "unprefixed"),
    "// CUSTOM-HOOK: brain-example begin",
    "// CUSTOM-HOOK: brain-example end",
    "// CUSTOM-HOOK: brain-example unknown",
    "// CUSTOM-HOOK: stray",
    pair.replace("brain-example end", "brain-other end"),
    `${pair}\n${pair}`,
  ])("rejects malformed, unpaired, stray or duplicate markers: %s", (source) => {
    expect(() => checkHooks({ "src/example.ts": source }, row)).toThrow();
  });
  it("rejects an unregistered source hook", () => {
    expect(() => checkHooks({ "src/example.ts": pair }, "")).toThrow();
  });
  it("rejects an orphaned or misplaced register entry", () => {
    expect(() => checkHooks({}, row)).toThrow();
    expect(() => checkHooks({ "src/other.ts": pair }, row)).toThrow();
    expect(() =>
      checkHooks({ "src/example.ts": pair }, row.replace("brain-example", "brain-stale"))
    ).toThrow();
  });
});
