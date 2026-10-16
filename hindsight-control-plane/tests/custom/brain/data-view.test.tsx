// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { lazy, Suspense } from "react";
import messages from "@/messages/en.json";
import { DataView } from "@/components/data-view";
import type { ConstellationProps } from "@/components/constellation";

const api = vi.hoisted(() => ({ getGraph: vi.fn(), enabled: true }));
vi.mock("@/custom/brain/feature", async (original) => ({
  ...(await original<typeof import("@/custom/brain/feature")>()),
  get BRAIN_ENABLED() {
    return api.enabled;
  },
}));
vi.mock("next/dynamic", () => ({
  default: (load: () => Promise<{ default: React.ComponentType }>) => {
    const Component = lazy(load);
    return (props: Record<string, unknown>) => (
      <Suspense>
        <Component {...props} />
      </Suspense>
    );
  },
}));
vi.mock("@/lib/api", () => ({ client: { getGraph: api.getGraph } }));
vi.mock("@/lib/bank-context", () => ({ useBank: () => ({ currentBank: "bank-a" }) }));
vi.mock("@/components/memory-detail-modal", () => ({
  MemoryDetailModal: ({ memoryId }: { memoryId: string | null }) => (
    <output data-testid="details-id">{memoryId}</output>
  ),
}));
vi.mock("@/components/tag-filter-input", () => ({ TagFilterInput: () => null }));
vi.mock("@/components/observation-scope-filter", () => ({ ObservationScopeFilter: () => null }));
vi.mock("@/components/constellation", () => ({
  Constellation: (props: ConstellationProps) => (
    <div data-testid="renderer" data-brain={String(!!props.brainRenderer)}>
      <button onClick={() => props.onNodeClick?.(props.data.nodes[0])}>Open node</button>
    </div>
  ),
}));

beforeEach(() => {
  api.enabled = true;
  localStorage.clear();
  api.getGraph.mockReset();
  api.getGraph.mockResolvedValue({
    nodes: [{ data: { id: "memory-a" } }],
    edges: [],
    table_rows: [{ id: "memory-a", text: "Memory A" }],
  });
});
afterEach(() => cleanup());

it("preserves bank/document/chunk filters while switching request budgets and returns to network", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <DataView factType="world" documentId="doc-a" chunkId="chunk-a" />
    </NextIntlClientProvider>
  );
  await waitFor(() => expect(api.getGraph).toHaveBeenCalledTimes(1));
  const initial = api.getGraph.mock.calls[0][0];
  expect(initial).toMatchObject({
    bank_id: "bank-a",
    type: "world",
    limit: 1000,
    document_id: "doc-a",
    chunk_id: "chunk-a",
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Brain" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Brain" }));
  await waitFor(() => expect(api.getGraph).toHaveBeenCalledTimes(2));
  expect(api.getGraph.mock.calls[1][0]).toEqual({ ...initial, limit: 500 });
  await waitFor(() =>
    expect(screen.getByTestId("renderer").getAttribute("data-brain")).toBe("true")
  );
  fireEvent.click(screen.getByRole("button", { name: "Open node" }));
  expect(screen.getByTestId("details-id").textContent).toBe("memory-a");
  fireEvent.click(screen.getByRole("button", { name: "Network" }));
  await waitFor(() => expect(api.getGraph).toHaveBeenCalledTimes(3));
  expect(api.getGraph.mock.calls[2][0]).toEqual(initial);
});

it("does not restore a persisted brain mode, change request limits or write storage with flag off", async () => {
  api.enabled = false;
  localStorage.setItem("hindsight-brain-layout", "brain");
  const writes = vi.spyOn(Storage.prototype, "setItem");
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <DataView factType="world" />
    </NextIntlClientProvider>
  );
  await waitFor(() => expect(screen.getByTestId("renderer")).toBeTruthy());
  expect(api.getGraph).toHaveBeenCalledTimes(1);
  expect(api.getGraph.mock.calls[0][0].limit).toBe(1000);
  expect(screen.getByTestId("renderer").getAttribute("data-brain")).toBe("false");
  expect(screen.queryByRole("button", { name: "Brain" })).toBeNull();
  expect(writes).not.toHaveBeenCalled();
  writes.mockRestore();
});

it("restores the upstream request budget when leaving the brain graph for the table", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <DataView factType="world" />
    </NextIntlClientProvider>
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Brain" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Brain" }));
  await waitFor(() => expect(api.getGraph.mock.calls.at(-1)?.[0].limit).toBe(500));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: messages.dataView.table })).toBeTruthy()
  );
  fireEvent.click(screen.getByRole("button", { name: messages.dataView.table }));
  await waitFor(() => expect(api.getGraph.mock.calls.at(-1)?.[0].limit).toBe(1000));
});
