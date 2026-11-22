import { NextResponse, type NextRequest } from "next/server";
import { appGoogleLogin, parseDeviceName } from "../../../../../lib/auth/app-session.js";
import { AuthError } from "../../../../../lib/auth/flow.js";

/** The phone's sign-in: `{ idToken, deviceName }` in, `{ token, email }` out. The token is shown once. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { idToken?: unknown; deviceName?: unknown } | null;
  const deviceName = parseDeviceName(body?.deviceName);
  if (typeof body?.idToken !== "string" || body.idToken === "" || deviceName === null) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  try {
    return NextResponse.json(await appGoogleLogin({ idToken: body.idToken, deviceName }));
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    return e.code === "not-allowed"
      ? NextResponse.json({ error: "not-allowed" }, { status: 403 })
      : NextResponse.json({ error: "invalid-token" }, { status: 401 });
  }
}
