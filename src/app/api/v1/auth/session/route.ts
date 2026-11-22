import { NextResponse, type NextRequest } from "next/server";
import { authenticateApi } from "../../../../../lib/auth/app-session.js";
import { revokeAppSession } from "../../../../../lib/db/app-sessions.js";

/** The app signing out: its own bearer session ends. A cookie caller has no app session to end. */
export async function DELETE(req: NextRequest) {
  const who = await authenticateApi(req);
  if (who === null) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (who.appSessionId !== null) await revokeAppSession(who.appSessionId);
  return new NextResponse(null, { status: 204 });
}
