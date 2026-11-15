import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, createConfig, sdk } from "@vectorize-io/hindsight-client";
import { getDataplaneHeaders } from "@/lib/hindsight-client";
import { ACCESS_KEY_COOKIE, verifySessionToken } from "@/lib/auth/session";
// CUSTOM-HOOK: public-health-cp begin
import { configuredAccessKey, unauthenticatedAccessAllowed } from "@/custom/auth/access-key";
// CUSTOM-HOOK: public-health-cp end

const HEALTH_CHECK_TIMEOUT_MS = 3000;

type DataplaneProbe = { ok: boolean; reason: "ok" | "timeout" | "unreachable" };

async function probeDataplane(): Promise<DataplaneProbe> {
  const dataplaneUrl = process.env.HINDSIGHT_CP_DATAPLANE_API_URL || "http://localhost:8888";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const healthClient = createClient(
      createConfig({
        baseUrl: dataplaneUrl,
        signal: controller.signal,
        headers: getDataplaneHeaders(),
      })
    );
    // A reachability probe, not a listing: ask for the smallest page the
    // endpoint will serve instead of pulling the default 100 banks.
    await sdk.listBanks({ client: healthClient, query: { limit: 1 } });
    return { ok: true, reason: "ok" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function detailAllowed(request: NextRequest): Promise<boolean> {
  if (unauthenticatedAccessAllowed()) return true;
  const accessKey = configuredAccessKey();
  if (!accessKey) return false;
  const sessionCookie = request.cookies.get(ACCESS_KEY_COOKIE)?.value;
  return verifySessionToken(sessionCookie, accessKey);
}

export async function GET(request: NextRequest) {
  // The public body is process liveness only. Callers treat a non-200 as
  // "the UI process is down", so a dataplane blip must not fail this probe.
  // Upstream address and error text stay off the public response.
  const body: { status: "ok"; dataplane?: { status: string; reason?: string } } = { status: "ok" };
  if (await detailAllowed(request)) {
    const probe = await probeDataplane();
    body.dataplane = probe.ok
      ? { status: "connected" }
      : { status: "disconnected", reason: probe.reason };
  }
  return NextResponse.json(body, { status: 200 });
}
