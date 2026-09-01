import { NextResponse, type NextRequest } from "next/server";
import { setCharacterAccount, deleteCharacter } from "../../../../lib/db/characters.js";
import { parseAccountId } from "../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const id = Number((await params).id);
  const accountId = parseAccountId(await req.json().catch(() => null));
  if (!Number.isInteger(id) || accountId === undefined) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await setCharacterAccount(id, accountId);
  return new NextResponse(null, { status: 204 });
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await deleteCharacter(Number((await params).id));
  return new NextResponse(null, { status: 204 });
}
