import { NextResponse, type NextRequest } from "next/server";
import { renameAccount, deleteAccount } from "../../../../lib/db/accounts.js";
import { parseName, parseId } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const name = parseName(await req.json().catch(() => null));
  if (id === null || !name) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await renameAccount(id, name);
  return new NextResponse(null, { status: 204 });
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await deleteAccount(id);
  return new NextResponse(null, { status: 204 });
}
