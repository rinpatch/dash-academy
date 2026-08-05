import { NextResponse } from "next/server";
import { getClient, normalizeIdentityId } from "@/app/lib/dash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identityId = new URL(request.url).searchParams.get("identityId");
  const normalized = identityId ? await normalizeIdentityId(identityId) : null;

  if (!normalized) {
    return NextResponse.json({ username: null }, { status: 400 });
  }

  try {
    const client = await getClient();
    const username = await client.getDpnsUsername(normalized);
    return NextResponse.json({ username: username ?? null });
  } catch {
    return NextResponse.json({ username: null }, { status: 503 });
  }
}
