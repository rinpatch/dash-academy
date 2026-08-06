import { NextResponse } from "next/server";
import { getClient, normalizeIdentityId, resetClient } from "@/app/lib/dash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identityId = new URL(request.url).searchParams.get("identityId");
  const normalized = identityId ? await normalizeIdentityId(identityId) : null;

  if (!normalized) {
    return NextResponse.json({ username: null }, { status: 400 });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const client = await getClient();
      const username = await client.getDpnsUsername(normalized);
      return NextResponse.json({ username: username ?? null });
    } catch (err) {
      const wasmErr = err as { message?: string; kind?: unknown; code?: number; isRetriable?: boolean };
      console.error("dpns-username lookup failed:", {
        message: wasmErr?.message,
        kind: wasmErr?.kind,
        code: wasmErr?.code,
        isRetriable: wasmErr?.isRetriable,
      });
      // stale cached quorum context is retriable; rebuild once and try again
      if (wasmErr?.isRetriable && attempt === 0) {
        resetClient();
        continue;
      }
      return NextResponse.json({ username: null }, { status: 503 });
    }
  }
  return NextResponse.json({ username: null }, { status: 503 });
}
