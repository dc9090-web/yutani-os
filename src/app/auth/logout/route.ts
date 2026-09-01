import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../lib/auth/session.js";
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
