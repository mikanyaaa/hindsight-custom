// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StalenessBadge } from "@/components/staleness-badge";
import { TagChip } from "@/components/ui/facet-chip";

const uiDir = join(process.cwd(), "src/components/ui");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

describe("quiet paper primitives", () => {
  it("keeps shared controls on the radius, type and 44px scale", () => {
    render(
      <>
        <Button>Save</Button>
        <Input aria-label="Name" />
        <Card data-testid="card">Panel</Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        <StalenessBadge isStale />
        <div data-testid="chip">
          <TagChip tag="notes" />
        </div>
      </>
    );
    const button = screen.getByRole("button", { name: "Save" }).className;
    expect(button).toContain("h-11");
    expect(button).toContain("rounded-md");
    expect(button).toContain("text-sm");
    const field = screen.getByRole("textbox", { name: "Name" }).className;
    expect(field).toContain("h-11");
    expect(field).toContain("rounded-md");
    expect(field).toContain("text-sm");
    expect(field).not.toContain("100,160,255");
    expect(screen.getByTestId("card").className).toContain("rounded-lg");
    expect(document.querySelector("th")?.className).toContain("text-xs");
    expect(document.querySelector("table")?.parentElement?.className).toContain("rounded-lg");
    expect(screen.getByTitle(/stale/i).className).toContain("text-xs");
    expect(screen.getByTitle(/stale/i).className).toContain("rounded-sm");
    expect(screen.getByTestId("chip").querySelector("span")?.className).toContain("text-sm");
  });

  it("does not leave the old type sizes, radii or blue edge in the primitives", () => {
    const banned = [
      /text-\[1[0-3]px\]/,
      /text-\[16px\]/,
      /leading-\[(?:19|22)px\]/,
      /rounded-\[(?:6|10|16)px\]/,
      /rgba\(100,\s*160,\s*255/,
    ];
    const offenders: string[] = [];
    for (const file of [...sourceFiles(uiDir), join(process.cwd(), "src/components/staleness-badge.tsx")]) {
      const source = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(source)) offenders.push(`${file} ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
