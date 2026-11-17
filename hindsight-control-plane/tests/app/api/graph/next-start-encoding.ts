/**
 * Regression: `next start` drops a route-set Content-Encoding header and still
 * sends the gzipped bytes. Unit tests call the route handler directly, so they
 * never see that. This runs the production server.
 *
 * Requires `next build` first. `next.config.ts` keeps distDir `.next` only when
 * PORT is unset or 9999, and `next start` sets PORT to its listen port before
 * loading that config. When 9999 is busy, the server listens on a free port and
 * `.next-<port>` is a symlink to the production build.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, symlinkSync, unlinkSync } from "node:fs";
import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

const PREFERRED_PORT = 9999;
const CP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const NEXT_BIN = join(CP_ROOT, "../node_modules/next/dist/bin/next");

const graph = {
  nodes: [{ data: { id: "encoding-regression", label: "x".repeat(2048) } }],
  edges: [],
  table_rows: [],
  total_units: 1,
};
const graphJson = JSON.stringify(graph);

function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", onError);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("server did not bind a TCP port"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const holder = createServer();
    holder.once("error", () => resolve(false));
    holder.listen(port, "127.0.0.1", () => {
      holder.close(() => resolve(true));
    });
  });
}

/**
 * 9999 reads the production distDir directly. Another port only works because
 * next.config.ts names the distDir after PORT, so point that name at `.next`.
 */
async function chooseAppPort(): Promise<{ port: number; distLink: string | null }> {
  if (await portFree(PREFERRED_PORT)) return { port: PREFERRED_PORT, distLink: null };
  const probe = createServer();
  const port = await listen(probe, 0);
  await closeServer(probe);
  const distLink = join(CP_ROOT, `.next-${port}`);
  if (existsSync(distLink)) throw new Error(`dist dir already exists: ${distLink}`);
  symlinkSync(".next", distLink);
  return { port, distLink };
}

function rawGet(
  url: string,
  headers: Record<string, string>
): Promise<{ status: number; encoding: string | undefined; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { headers }, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const raw = res.headers["content-encoding"];
        resolve({
          status: res.statusCode ?? 0,
          encoding: Array.isArray(raw) ? raw.join(",") : raw,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function decodeBody(encoding: string | undefined, body: Buffer): string {
  const token = (encoding ?? "identity").split(",")[0]?.trim().toLowerCase() || "identity";
  if (token === "identity") {
    if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
      throw new Error("response is gzip-compressed but has no Content-Encoding header");
    }
    return body.toString("utf8");
  }
  if (token === "gzip" || token === "x-gzip") return gunzipSync(body).toString("utf8");
  if (token === "deflate") return inflateSync(body).toString("utf8");
  if (token === "br") return brotliDecompressSync(body).toString("utf8");
  throw new Error(`unsupported content-encoding: ${token}`);
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = once(child, "exit");
  const timer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, 5000);
  await exited;
  clearTimeout(timer);
}

async function main(): Promise<void> {
  if (!existsSync(join(CP_ROOT, ".next/BUILD_ID"))) {
    throw new Error("production build missing; run next build before this test");
  }
  if (!existsSync(NEXT_BIN)) {
    throw new Error("next binary missing; install dependencies before this test");
  }

  const { port, distLink } = await chooseAppPort();
  let stub: Server | null = null;
  let server: ChildProcess | null = null;
  try {
    stub = createServer((req, res) => {
      const path = req.url ?? "";
      if (!path.startsWith("/v1/default/banks/encoding-regression/graph")) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ detail: "unexpected dataplane path" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(graphJson);
    });
    const stubPort = await listen(stub, 0);

    const env = { ...process.env };
    delete env.PORT;
    delete env.HINDSIGHT_CP_ACCESS_KEY;
    delete env.HINDSIGHT_CP_DATAPLANE_API_KEY;
    delete env.NEXT_PUBLIC_BASE_PATH;
    env.HINDSIGHT_CP_ALLOW_UNAUTHENTICATED = "true";
    env.HINDSIGHT_CP_DATAPLANE_API_URL = `http://127.0.0.1:${stubPort}`;

    server = spawn(process.execPath, [NEXT_BIN, "start", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: CP_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    const capture = (chunk: Buffer) => {
      logs += chunk.toString("utf8");
      if (logs.length > 40_000) logs = logs.slice(-40_000);
    };
    server.stdout?.on("data", capture);
    server.stderr?.on("data", capture);

    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) {
        throw new Error(`next start exited before it was ready\n${logs}`);
      }
      try {
        const health = await rawGet(`http://127.0.0.1:${port}/api/health`, {});
        if (health.status === 200) {
          ready = true;
          break;
        }
      } catch {
        // Server is still binding.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`next start did not become ready\n${logs}`);

    const response = await rawGet(`http://127.0.0.1:${port}/api/graph?bank_id=encoding-regression&limit=10`, {
      "accept-encoding": "gzip",
      accept: "application/json",
    });
    if (response.status !== 200) {
      throw new Error(
        `graph request returned HTTP ${response.status}: ${response.body.toString("utf8").slice(0, 500)}\n${logs}`
      );
    }

    let text: string;
    try {
      text = decodeBody(response.encoding, response.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "decode failed";
      throw new Error(
        `${message} (content-encoding=${response.encoding ?? "absent"}, first bytes=${response.body.subarray(0, 4).toString("hex")})`
      );
    }
    const parsed: unknown = JSON.parse(text);
    if (JSON.stringify(parsed) !== graphJson) {
      throw new Error("decoded graph JSON did not match the upstream body");
    }
  } finally {
    if (server) await stop(server);
    if (stub) await closeServer(stub);
    if (distLink && existsSync(distLink)) unlinkSync(distLink);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "graph encoding regression failed");
  process.exit(1);
});
