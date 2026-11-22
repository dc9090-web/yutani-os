import { NextResponse, type NextRequest } from "next/server";
import { appGoogleLogin, KeysUnavailableError, parseDeviceName } from "../../../../../lib/auth/app-session.js";
import { AuthError } from "../../../../../lib/auth/flow.js";

/** The phone's sign-in: `{ idToken, deviceName }` in, `{ token, email }` out. The token is shown once. */
// An ID token is about 1.2 KB; nothing honest comes near this. The route is the API's only public one.
const MAX_BODY = 8 * 1024;

export async function POST(req: NextRequest) {
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return NextResponse.json({ error: "bad-request" }, { status: 400 });
  const body = parseJson(text) as { idToken?: unknown; deviceName?: unknown } | null;
  const deviceName = parseDeviceName(body?.deviceName);
  if (typeof body?.idToken !== "string" || body.idToken === "" || deviceName === null) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await appGoogleLogin({ idToken: body.idToken, deviceName }));
  } catch (e) {
    if (e instanceof KeysUnavailableError) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    if (!(e instanceof AuthError)) throw e;
    return e.code === "not-allowed"
      ? NextResponse.json({ error: "not-allowed" }, { status: 403 })
      : NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}
