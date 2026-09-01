import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "eve_session";
export const OAUTH_COOKIE = "eve_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const OAUTH_MAX_AGE = 600;
export interface SessionPayload { activeCharacterId: number | null; iat: number }
export interface OauthPayload { state: string; verifier: string; iat: number }

const mac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function signPayload(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

export function verifyPayload<T>(token: string | undefined, secret: string, maxAgeSec: number, now = Math.floor(Date.now() / 1000)): T | null {
  if (!token) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = mac(body, secret);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { iat?: number };
    if (typeof payload.iat !== "number" || now - payload.iat > maxAgeSec) return null;
    return payload;
  } catch { return null; }
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true as const, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" as const, maxAge };
}

export async function readSession(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const { getConfig } = await import("../config.js");
  const jar = await cookies();
  return verifyPayload<SessionPayload>(jar.get(SESSION_COOKIE)?.value, getConfig().sessionSecret, SESSION_MAX_AGE);
}
