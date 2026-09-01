import { NextResponse } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { startLogin } from "../../../lib/auth/flow.js";
import { OAUTH_COOKIE, OAUTH_MAX_AGE, cookieOptions } from "../../../lib/auth/session.js";

export async function GET() {
  const { url, oauthCookie } = await startLogin(getConfig());
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, oauthCookie, cookieOptions(OAUTH_MAX_AGE));
  return res;
}
