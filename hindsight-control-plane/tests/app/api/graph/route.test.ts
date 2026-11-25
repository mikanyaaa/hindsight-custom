import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hindsight-client", () => ({
  DATAPLANE_URL: "http://dataplane",
  getDataplaneHeaders: () => ({}),
}));

import { GET } from "@/app/api/graph/route";

const graph = { nodes: [{ data: { id: "a" } }], edges: [], table_rows: [], total_units: 1 };

function get(headers: Record<string, string> = {}, signal?: AbortSignal) {
  return GET(
    new NextRequest("http://localhost/api/graph?bank_id=b&type=world&limit=10", {
      headers,
      signal,
    })
  );
}

describe("GET /api/graph", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Next compresses route responses itself. This route must not gzip again:
  // a missing Content-Encoding, or a second gzip, is not JSON the browser can read.
  it("leaves compression to Next even when the browser accepts gzip", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(graph))));

    const response = await get({ "accept-encoding": "gzip, deflate, br" });

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("vary")).toBeNull();
    expect(await response.json()).toEqual(graph);
  });

  it("streams it plain to a client that doesn't ask for gzip", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(graph))));

    const response = await get();

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(await response.json()).toEqual(graph);
  });

  it("hands the browser's abort to the dataplane read", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(graph)));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await get({}, controller.signal);
    controller.abort();

    expect(fetchMock.mock.calls[0][0]).toBe("http://dataplane/v1/default/banks/b/graph?type=world&limit=10");
    expect((fetchMock.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
  });
});
