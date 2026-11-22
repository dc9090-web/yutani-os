import { NextResponse } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { startLogin } from "../../../lib/auth/flow.js";
import { OAUTH_COOKIE, OAUTH_MAX_AGE, cookieOptions, readSession } from "../../../lib/auth/session.js";

/** EVE SSO only adds (or re-authorises) a character for the signed-in owner; it never signs anyone in. */
export async function GET() {
  const config = getConfig();
  if (!(await readSession())) return NextResponse.redirect(new URL("/login", config.siteOrigin));
  const { url, oauthCookie } = await startLogin(config);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, oauthCookie, cookieOptions(OAUTH_MAX_AGE));
  return res;
}
