import { NextResponse } from "next/server";
import { getClient, normalizeIdentityId } from "@/app/lib/dash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = { identityId?: unknown; operation?: unknown; reference?: unknown };

export async function POST(request: Request) {
  let body: VerifyBody;

  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return failure("invalid", "Send a JSON body containing an identityId.", 400);
  }

  // Lessons other than the identity one post { operation, reference }. The identityId form is the
  // original identity-only path and stays as it is.
  if (typeof body.operation === "string") {
    if (typeof body.reference !== "string" || body.reference.trim().length === 0) {
      return failure("invalid", "Paste the public value your script printed.", 400);
    }
    return await verifyOperation(body.operation, body.reference.trim());
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

/**
 * Verification for an operation named in curriculum/lessons.json. Only operations with a real check
 * belong here: an operation that is not listed is reported as unsupported rather than passed, so a
 * lesson can never award progress for work nobody verified.
 */
async function verifyOperation(operation: string, reference: string) {
  const identityId = await normalizeIdentityId(reference);

  try {
    switch (operation) {
      case "identity-create": {
        if (!identityId) return failure("invalid", "That is not a valid Dash Platform identity ID. Copy the complete Base58 value and try again.", 400);
        const identity = await (await getClient()).getIdentity(identityId);
        if (!identity) return failure("not_found", "Dash Platform testnet could not find that identity yet. Check the ID, wait a moment, and try again.", 404);
        const facts = [
          { label: "Identity ID", value: identity.id.toBase58() },
          { label: "Public keys", value: String(identity.publicKeys.length) },
          { label: "Credit balance", value: `${identity.balance} credits` },
        ];
        identity.free();
        return NextResponse.json({ status: "verified" as const, reference: identityId, facts });
      }
      case "dpns-register": {
        if (!identityId) return failure("invalid", "Paste the identity ID that owns the name, not the name itself.", 400);
        const username = await (await getClient()).getDpnsUsername(identityId);
        if (!username) return failure("not_found", "No DPNS name is registered to that identity yet. Registration can take a moment to confirm.", 404);
        return NextResponse.json({
          status: "verified" as const,
          reference: identityId,
          facts: [{ label: "Registered name", value: username }, { label: "Owner identity", value: identityId }],
        });
      }
      default:
        return failure("unsupported", `Verification for "${operation}" is not implemented yet.`, 501);
    }
  } catch {
    return failure("unavailable", "Dash Platform testnet could not be reached. Your input is unchanged—please try again.", 503);
  }
}

function failure(status: "invalid" | "not_found" | "unavailable" | "unsupported", message: string, code: number) {
  return NextResponse.json({ status, message }, { status: code });
}
