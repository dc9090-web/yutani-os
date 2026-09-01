import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "../../../lib/config.js";
import { getCharacter } from "../../../lib/db/characters.js";
import { SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, readSession, signPayload } from "../../../lib/auth/session.js";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = Number(form.get("characterId"));
  const next = String(form.get("next") ?? "/");
  const session = await readSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  const character = await getCharacter(id);
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.nextUrl.origin), 303);
  if (character) {
    res.cookies.set(SESSION_COOKIE, signPayload({ activeCharacterId: id, iat: Math.floor(Date.now() / 1000) }, getConfig().sessionSecret), cookieOptions(SESSION_MAX_AGE));
  }
  return res;
}
