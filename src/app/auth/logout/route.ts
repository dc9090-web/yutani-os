import { NextResponse } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { SESSION_COOKIE } from "../../../lib/auth/session.js";
export async function POST() {
  const res = NextResponse.redirect(new URL("/login", getConfig().siteOrigin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
