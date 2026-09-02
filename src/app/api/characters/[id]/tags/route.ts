import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../../lib/db/characters.js";
import { setCharacterTags } from "../../../../../lib/db/tags.js";
import { parseId, parseTagIds } from "../../../../../lib/api/json.js";
type Ctx = { params: Promise<{ id: string }> };
export async function PUT(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const tagIds = parseTagIds(await req.json().catch(() => null));
  if (id === null || tagIds === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if ((await getCharacter(id)) === null) return NextResponse.json({ error: "not found" }, { status: 404 });
  await setCharacterTags(id, tagIds);
  return new NextResponse(null, { status: 204 });
}
