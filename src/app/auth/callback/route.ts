import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { completeLogin, AuthError } from "../../../lib/auth/flow.js";
import { OAUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, readSession, signPayload, type SessionPayload } from "../../../lib/auth/session.js";

export async function GET(req: NextRequest) {
  const config = getConfig();
  const url = req.nextUrl;
  try {
    const { characterId } = await completeLogin(
      { code: url.searchParams.get("code"), state: url.searchParams.get("state"), oauthCookie: req.cookies.get(OAUTH_COOKIE)?.value }, config);
    const existing = await readSession();
    const payload: SessionPayload = { activeCharacterId: existing?.activeCharacterId ?? characterId, iat: Math.floor(Date.now() / 1000) };
    const res = NextResponse.redirect(new URL(existing ? "/settings" : "/", url.origin));
    res.cookies.set(SESSION_COOKIE, signPayload(payload, config.sessionSecret), cookieOptions(SESSION_MAX_AGE));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "unknown";
    console.error("[auth] callback failed:", code, (e as Error).message);
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, url.origin));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  }
}
