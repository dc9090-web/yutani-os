import { NextResponse, type NextRequest } from "next/server";
import { revokeAppSession } from "../../../../lib/db/app-sessions.js";
import { parseId } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
/** Settings › Signed-in phones › Revoke. Behind the site's cookie like every other `/api` route. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await revokeAppSession(id);
  return new NextResponse(null, { status: 204 });
}
