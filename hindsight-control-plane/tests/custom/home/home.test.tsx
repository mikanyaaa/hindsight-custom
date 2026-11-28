// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { groupWeek, harnessId, recallQuery, tagLabel, weekWindow } from "@/custom/home/activity";
import { homeCopy } from "@/custom/home/copy";
import { HomeDesk } from "@/custom/home/home-desk";

const push = vi.hoisted(() => vi.fn());
const listMemories = vi.hoisted(() =>
  vi.fn(async () => ({
    items: [
      {
        id: "m1",
        text: "Beispiel one",
        tags: ["demo", "harness:cursor-cli"],
        date: "2026-11-14T00:00:00Z",
      },
      {
        id: "m2",
        text: "Beispiel two",
        tags: ["harness:cursor-cli"],
        date: "2026-11-13T00:00:00Z",
      },
    ],
    total: 2,
    limit: 100,
    offset: 0,
  }))
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/lib/bank-context", () => ({
  useBank: () => ({ currentBank: "beispiel-bank", currentBankName: "Beispiel Studio" }),
}));
vi.mock("@/custom/atlas-map/atlas-map", () => ({
  AtlasMap: ({
    onNodeClick,
    model,
  }: {
    onNodeClick?: (node: { id: string }) => void;
    model: { toneById: Map<string, number> } | null;
  }) => {
    const id = model?.toneById.keys().next().value;
    return id ? (
      <button type="button" onClick={() => onNodeClick?.({ id })}>
        map-node
      </button>
    ) : null;
  },
}));
vi.mock("@/components/memory-detail-modal", () => ({
  MemoryDetailModal: ({ memoryId }: { memoryId: string | null }) =>
    memoryId ? <div>memory:{memoryId}</div> : null,
}));
vi.mock("@/lib/api", () => ({
  client: {
    getBankStats: async () => ({ total_nodes: 14, total_documents: 4, total_links: 13 }),
    getPageTree: async () => ({ roots: [{ id: "p1", kind: "page", children: [] }] }),
    listMemories,
    listMentalModels: async () => ({
      items: [
        {
          id: "mm-1",
          name: "Beispiel-Modell",
          is_stale: false,
          trigger: { refresh_after_consolidation: false },
        },
      ],
      total: 1,
      limit: 6,
      offset: 0,
    }),
    getGraph: async () => ({
      nodes: [{ data: { id: "m1", label: "Beispiel one", type: "world" } }],
      edges: [],
    }),
  },
}));

describe("home week", () => {
  it("gives every locale the same home strings", () => {
    const keys = Object.keys(homeCopy.en).sort();
    for (const copy of Object.values(homeCopy)) {
      expect(Object.keys(copy).sort()).toEqual(keys);
      for (const value of Object.values(copy)) expect(value.length).toBeGreaterThan(0);
    }
  });

  it("keeps the last seven days and encodes the recall question", () => {
    const now = new Date("2026-11-15T12:00:00.000Z");
    const span = weekWindow(now);
    expect(span.start).toBe("2026-11-08T12:00:00.000Z");
    expect(span.end > now.toISOString()).toBe(true);
    expect(recallQuery(" was ist neu ")).toBe("?view=recall&q=was%20ist%20neu");
  });

  it("counts a memory under every tag and leads with the bot tag", () => {
    const groups = groupWeek(
      [
        { id: "m1", text: "one", tags: ["demo", "harness:cursor-cli"], at: "a" },
        { id: "m2", text: "two", tags: ["demo"], at: "b" },
        { id: "m3", text: "three", tags: [], at: "c" },
      ],
      null
    );
    expect(groups.map((group) => group.tag)).toEqual(["harness:cursor-cli", "demo", ""]);
    expect(groups[1].count).toBe(2);
    expect(
      groupWeek([{ id: "m1", text: "one", tags: ["demo", "other"], at: "a" }], "demo")
    ).toEqual([
      {
        tag: "demo",
        count: 1,
        samples: [{ id: "m1", text: "one", tags: ["demo", "other"], at: "a" }],
      },
    ]);
    expect(tagLabel("harness:cursor-cli", "No tag")).toBe("cursor-cli");
    expect(tagLabel("", "No tag")).toBe("No tag");
    expect(harnessId("harness:cursor-cli")).toBe("cursor-cli");
    expect(harnessId("demo")).toBeNull();
  });
});

describe("Atlas home", () => {
  beforeEach(() => {
    push.mockClear();
    listMemories.mockClear();
  });

  it("shows the bank name, submits Recall, opens map memories and filters the week", async () => {
    render(<HomeDesk bankId="beispiel-bank" onNavigate={() => {}} />);

    expect(screen.getByRole("heading", { level: 1, name: "Beispiel Studio" })).toBeTruthy();
    const field = screen.getByRole("textbox", { name: "Recall" });
    expect(field.getAttribute("placeholder")).toBe("Search this bank");
    expect(screen.getByRole("button", { name: /statMemories/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /statDocuments/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /statPages/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Links/ })).toBeTruthy();

    fireEvent.change(field, { target: { value: "was ist neu" } });
    fireEvent.click(screen.getByRole("button", { name: "Recall" }));
    expect(push).toHaveBeenCalledWith("/banks/beispiel-bank?view=recall&q=was%20ist%20neu");

    await waitFor(() => expect(screen.getAllByText("Beispiel one").length).toBeGreaterThan(0));
    expect(screen.getByText("inSync")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "map-node" }));
    expect(screen.getByText("memory:m1")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("button", { name: "All tags" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /^demo/ }));
    await waitFor(() =>
      expect(listMemories).toHaveBeenCalledWith(
        "beispiel-bank",
        expect.objectContaining({
          tags: ["demo"],
          tagsMatch: "any_strict",
          timeField: "created_at",
        })
      )
    );
  });
});
