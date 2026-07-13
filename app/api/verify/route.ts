import { NextResponse } from "next/server";
import { getClient, normalizeIdentityId } from "@/app/lib/dash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = { identityId?: unknown };

export async function POST(request: Request) {
  let body: VerifyBody;

  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return failure("invalid", "Send a JSON body containing an identityId.", 400);
  }

  if (typeof body.identityId !== "string") {
    return failure("invalid", "Paste the public Base58 identity ID printed by your script.", 400);
  }

  const identityId = await normalizeIdentityId(body.identityId);
  if (!identityId) {
    return failure("invalid", "That is not a valid Dash Platform identity ID. Copy the complete Base58 value and try again.", 400);
  }

  try {
    const client = await getClient();
    const identity = await client.getIdentity(identityId);

    if (!identity) {
      return failure("not_found", "Dash Platform testnet could not find that identity yet. Check the ID, wait a moment, and try again.", 404);
    }

    const response = NextResponse.json({
      status: "verified" as const,
      identity: {
        id: identity.id.toBase58(),
        balanceCredits: String(identity.balance),
        publicKeyCount: identity.publicKeys.length,
      },
    });
    identity.free();
    return response;
  } catch {
    return failure("unavailable", "Dash Platform testnet could not be reached. Your identity ID is unchanged—please try again.", 503);
  }
}

function failure(status: "invalid" | "not_found" | "unavailable", message: string, code: number) {
  return NextResponse.json({ status, message }, { status: code });
}
