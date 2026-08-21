import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Signed cookies, no session store. The cookie carries its own HMAC.
 *
 * Nothing in it is secret from the learner — it's their own key — so the signature is only
 * there to stop them substituting someone else's.
 */

const SESSION_COOKIE = "dash-academy.learner";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // no reason to sign anyone out of their own progress

function secret(): string | null {
  const value = process.env.DASH_SESSION_SECRET;
  return value && value.length >= 16 ? value : null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function seal(payload: string, key: string): string {
  return `${payload}.${sign(payload, key)}`;
}

function unseal(value: string | undefined, key: string): string | null {
  if (!value) return null;
  const index = value.lastIndexOf(".");
  if (index <= 0) return null;
  const payload = value.slice(0, index);
  const expected = Buffer.from(sign(payload, key));
  const actual = Buffer.from(value.slice(index + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return payload;
}

const BASE_COOKIE = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

/** The learner key (hex) this request is authenticated as, or null. */
export async function readSession(): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const payload = unseal((await cookies()).get(SESSION_COOKIE)?.value, key);
  if (!payload) return null;

  const [learnerKeyHex, expiresAt] = payload.split(":");
  if (!learnerKeyHex || !/^[0-9a-f]{64}$/.test(learnerKeyHex)) return null;
  if (!expiresAt || Number(expiresAt) < Date.now()) return null;
  return learnerKeyHex;
}

export async function startSession(learnerKeyHex: string): Promise<void> {
  const key = secret();
  if (!key) throw new Error("DASH_SESSION_SECRET is not configured");
  const payload = `${learnerKeyHex}:${Date.now() + SESSION_MAX_AGE * 1000}`;
  (await cookies()).set(SESSION_COOKIE, seal(payload, key), {
    ...BASE_COOKIE,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

