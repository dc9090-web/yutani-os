import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { getCharacter } from "../../../lib/db/characters.js";
import { safeNextPath } from "../../../lib/auth/flow.js";
import { SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, readSession, signPayload } from "../../../lib/auth/session.js";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = Number(form.get("characterId"));
  const next = safeNextPath(form.get("next"), req.nextUrl.origin);
  const session = await readSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 303);
  if (!Number.isInteger(id) || id <= 0) return res;
  const character = await getCharacter(id);
  if (character) {
    res.cookies.set(SESSION_COOKIE, signPayload({ activeCharacterId: id, iat: Math.floor(Date.now() / 1000) }, getConfig().sessionSecret), cookieOptions(SESSION_MAX_AGE));
  }
  return res;
}
