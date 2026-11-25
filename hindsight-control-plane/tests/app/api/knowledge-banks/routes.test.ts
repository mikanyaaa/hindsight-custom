import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hindsight-client", async () => {
  const { createClient, createConfig, sdk } = await import("@vectorize-io/hindsight-client");
  const DATAPLANE_URL = "http://dataplane";
  return {
    DATAPLANE_URL,
    getDataplaneHeaders: (extra?: Record<string, string>) => ({
      Authorization: "Bearer secret",
      ...extra,
    }),
    dataplaneBankUrl: (bankId: string, suffix = "") =>
      `${DATAPLANE_URL}/v1/default/banks/${encodeURIComponent(bankId)}${suffix}`,
    sdk,
    lowLevelClient: createClient(createConfig({ baseUrl: DATAPLANE_URL })),
  };
});

import { GET as getDocuments } from "@/app/api/knowledge-banks/[bankId]/documents/route";
import { GET as getFile } from "@/app/api/knowledge-banks/[bankId]/documents/[documentId]/file/route";
import { GET as getMedia } from "@/app/api/knowledge-banks/[bankId]/documents/[documentId]/passages/[index]/media/route";
import { POST as ingestFiles } from "@/app/api/knowledge-banks/[bankId]/files/ingest/route";
import { GET as listKnowledgeOps } from "@/app/api/knowledge-banks/[bankId]/operations/route";
import {
  DELETE as cancelKnowledgeOp,
  GET as getKnowledgeOp,
} from "@/app/api/knowledge-banks/[bankId]/operations/[operationId]/route";
import { POST as retryKnowledgeOp } from "@/app/api/knowledge-banks/[bankId]/operations/[operationId]/retry/route";
import { DELETE as deleteKnowledgeOp } from "@/app/api/knowledge-banks/[bankId]/operations/[operationId]/delete/route";
import {
  DELETE as cancelMemoryOp,
  GET as listMemoryOps,
} from "@/app/api/operations/[agentId]/route";
import {
  DELETE as deleteMemoryOp,
  GET as getMemoryOp,
  POST as retryMemoryOp,
} from "@/app/api/banks/[bankId]/operations/[operationId]/route";

function req(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init) as NextRequest & { nextUrl: URL };
  Object.defineProperty(request, "nextUrl", { value: new URL(url) });
  return request;
}

const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });
const media = ctx({ bankId: "docs", documentId: "d", index: "0" });
const file = ctx({ bankId: "docs", documentId: "d" });
const OP = "11111111-1111-4111-8111-111111111111";
const knowledgeBank = ctx({ bankId: "my/bank" });
const knowledgeOp = ctx({ bankId: "my/bank", operationId: OP });
const memoryOp = ctx({ bankId: "mem", operationId: OP });
const memoryAgent = ctx({ agentId: "mem" });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function upstreamCall(spy: { mock: { calls: unknown[][] } }): { url: string; method: string } {
  const [input, init] = spy.mock.calls[0] as [Request | string, RequestInit | undefined];
  if (input instanceof Request) return { url: input.url, method: input.method };
  return { url: String(input), method: init?.method ?? "GET" };
}

afterEach(() => vi.restoreAllMocks());

describe("/api/knowledge-banks routes", () => {
  it("sends a JSON call through the SDK with the bank id encoded", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"documents":[],"total":0}', {
        headers: { "content-type": "application/json" },
      })
    );
    const res = await getDocuments(
      req("http://cp/api/knowledge-banks/my%2Fbank/documents?limit=25&status=ready"),
      ctx({ bankId: "my/bank" })
    );
    const sent = fetchSpy.mock.calls[0][0] as Request;
    expect(sent.url).toBe(
      "http://dataplane/v1/default/knowledge-banks/my%2Fbank/documents?limit=25&status=ready"
    );
    expect(await res.json()).toEqual({ documents: [], total: 0 });
  });

  it("passes an upstream error's reason and status through", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"detail":"knowledge bank not found"}', {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    );
    const res = await getDocuments(req("http://cp/x"), ctx({ bankId: "nope" }));
    expect(res.status).toBe(404);
    expect((await res.json()).details).toBe("knowledge bank not found");
  });

  it("refuses dot segments that would escape the prefix", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await getFile(req("http://cp/x"), ctx({ bankId: "..", documentId: "d" }));
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("streams a multipart upload with the browser's boundary", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"document_ids":["d"]}', { status: 202 }));
    const form = new FormData();
    form.append("files", new File(["hello"], "a.md", { type: "text/markdown" }));
    const browserReq = new Request("http://cp/api/knowledge-banks/docs/files", {
      method: "POST",
      body: form,
    });
    const contentType = browserReq.headers.get("content-type")!;
    const res = await ingestFiles(
      req("http://cp/api/knowledge-banks/docs/files/ingest", {
        method: "POST",
        body: await browserReq.arrayBuffer(),
        headers: { "content-type": contentType },
      }),
      ctx({ bankId: "docs" })
    );
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "http://dataplane/v1/default/knowledge-banks/docs/files/ingest"
    );
    const init = fetchSpy.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(contentType);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(res.status).toBe(202);
  });

  it("serves a byte range of passage media the dataplane sent whole", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
        headers: { "content-type": "video/mp4" },
      })
    );
    const res = await getMedia(
      req("http://cp/api/knowledge-banks/docs/documents/d/passages/0/media", {
        headers: { range: "bytes=2-4" },
      }),
      media
    );
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 2-4/10");
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([2, 3, 4]);
  });

  it("answers 416 for a range past the end of the media", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array(4)));
    const res = await getMedia(req("http://cp/x", { headers: { range: "bytes=10-" } }), media);
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */4");
  });

  it("names an untyped original by its file name so the browser can preview it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": "inline; filename*=UTF-8''demo%20clip.MP4",
        },
      })
    );
    const res = await getFile(req("http://cp/api/knowledge-banks/docs/documents/d/file"), file);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-disposition")).toContain("inline");
  });

  it("lists a knowledge bank's operations on the knowledge-bank dataplane", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse({ bank_id: "my/bank", total: 0, limit: 10, offset: 0, operations: [] })
      );
    const res = await listKnowledgeOps(
      req(
        "http://cp/api/knowledge-banks/my%2Fbank/operations?limit=10&offset=0&exclude_parents=true&status=failed&type=knowledge_ingest"
      ),
      knowledgeBank
    );
    expect(upstreamCall(fetchSpy)).toEqual({
      url: "http://dataplane/v1/default/knowledge-banks/my%2Fbank/operations?status=failed&type=knowledge_ingest&limit=10&offset=0&exclude_parents=true",
      method: "GET",
    });
    expect(await res.json()).toEqual({
      bank_id: "my/bank",
      total: 0,
      limit: 10,
      offset: 0,
      operations: [],
    });
  });

  it("gets, cancels, retries, and deletes a knowledge bank operation on its own routes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const cases: Array<{
      run: () => Promise<Response>;
      url: string;
      method: string;
    }> = [
      {
        run: () => getKnowledgeOp(req("http://cp/x"), knowledgeOp),
        url: `http://dataplane/v1/default/knowledge-banks/my%2Fbank/operations/${OP}`,
        method: "GET",
      },
      {
        run: () => getKnowledgeOp(req("http://cp/x?include_payload=true"), knowledgeOp),
        url: `http://dataplane/v1/default/knowledge-banks/my%2Fbank/operations/${OP}?include_payload=true`,
        method: "GET",
      },
      {
        run: () => cancelKnowledgeOp(req("http://cp/x", { method: "DELETE" }), knowledgeOp),
        url: `http://dataplane/v1/default/knowledge-banks/my%2Fbank/operations/${OP}`,
        method: "DELETE",
      },
      {
        run: () => retryKnowledgeOp(req("http://cp/x", { method: "POST" }), knowledgeOp),
        url: `http://dataplane/v1/default/knowledge-banks/my%2Fbank/operations/${OP}/retry`,
        method: "POST",
      },
      {
        run: () => deleteKnowledgeOp(req("http://cp/x", { method: "DELETE" }), knowledgeOp),
        url: `http://dataplane/v1/default/knowledge-banks/my%2Fbank/operations/${OP}/delete`,
        method: "DELETE",
      },
    ];
    for (const action of cases) {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ operation_id: OP, success: true }));
      const res = await action.run();
      expect(upstreamCall(fetchSpy)).toEqual({ url: action.url, method: action.method });
      expect(res.status).toBe(200);
      fetchSpy.mockClear();
    }
  });

  it("keeps memory-bank operation calls on the memory-bank dataplane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const listUrl = "http://cp/api/operations/mem?limit=10&offset=0&exclude_parents=true";
    const cases: Array<{
      run: () => Promise<Response>;
      url: string;
      method: string;
    }> = [
      {
        run: () => listMemoryOps(req(listUrl), memoryAgent),
        url: "http://dataplane/v1/default/banks/mem/operations?limit=10&offset=0&exclude_parents=true",
        method: "GET",
      },
      {
        run: () => getMemoryOp(req("http://cp/x?include_payload=true"), memoryOp),
        url: `http://dataplane/v1/default/banks/mem/operations/${OP}?include_payload=true`,
        method: "GET",
      },
      {
        run: () =>
          cancelMemoryOp(
            req(`http://cp/api/operations/mem?operation_id=${OP}`, { method: "DELETE" }),
            memoryAgent
          ),
        url: `http://dataplane/v1/default/banks/mem/operations/${OP}`,
        method: "DELETE",
      },
      {
        run: () => retryMemoryOp(req("http://cp/x", { method: "POST" }), memoryOp),
        url: `http://dataplane/v1/default/banks/mem/operations/${encodeURIComponent(OP)}/retry`,
        method: "POST",
      },
      {
        run: () => deleteMemoryOp(req("http://cp/x", { method: "DELETE" }), memoryOp),
        url: `http://dataplane/v1/default/banks/mem/operations/${OP}/delete`,
        method: "DELETE",
      },
    ];
    for (const action of cases) {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ operation_id: OP, success: true }));
      const res = await action.run();
      const sent = upstreamCall(fetchSpy);
      expect(sent).toEqual({ url: action.url, method: action.method });
      expect(sent.url).not.toContain("/knowledge-banks/");
      expect(res.status).toBe(200);
      fetchSpy.mockClear();
    }
  });

  it("sandboxes an uploaded original, but not a PDF, which the browser would then not show", async () => {
    for (const [type, sandboxed] of [
      ["text/html", true],
      ["application/pdf", false],
    ] as const) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(new Uint8Array([1]), { headers: { "content-type": type } })
      );
      const res = await getFile(req("http://cp/api/knowledge-banks/docs/documents/d/file"), file);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-security-policy")).toBe(sandboxed ? "sandbox" : null);
    }
  });
});
