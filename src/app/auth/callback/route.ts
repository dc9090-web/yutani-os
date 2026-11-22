import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { completeLogin, AuthError } from "../../../lib/auth/flow.js";
import { OAUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, readSession, signPayload, withActiveCharacter } from "../../../lib/auth/session.js";

/** The end of "add a character": the Google session stays as it is, apart from the active character when it had none. */
export async function GET(req: NextRequest) {
  const config = getConfig();
  const session = await readSession();
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", config.siteOrigin));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  }
  const url = req.nextUrl;
  try {
    const { characterId } = await completeLogin(
      { code: url.searchParams.get("code"), state: url.searchParams.get("state"), oauthCookie: req.cookies.get(OAUTH_COOKIE)?.value }, config);
    const res = NextResponse.redirect(new URL("/settings", config.siteOrigin));
    res.cookies.set(SESSION_COOKIE, signPayload(withActiveCharacter(session, session.activeCharacterId ?? characterId), config.sessionSecret), cookieOptions(SESSION_MAX_AGE));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  } catch (e) {
    const code = e instanceof AuthError ? e.code : "unknown";
    console.error("[auth] character authorisation failed:", code, (e as Error).message);
    const res = NextResponse.redirect(new URL(`/settings?error=${code}`, config.siteOrigin));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  }
}
