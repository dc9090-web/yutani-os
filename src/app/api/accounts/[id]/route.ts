import { NextResponse, type NextRequest } from "next/server";
import { renameAccount, deleteAccount } from "../../../../lib/db/accounts.js";
import { parseName } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  const name = parseName(await req.json().catch(() => null));
  if (!Number.isInteger(id) || !name) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await renameAccount(id, name);
  return new NextResponse(null, { status: 204 });
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await deleteAccount(Number((await params).id));
  return new NextResponse(null, { status: 204 });
}
