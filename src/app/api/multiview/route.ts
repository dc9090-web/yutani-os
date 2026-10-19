import { NextResponse, type NextRequest } from "next/server";
import { listCharacters } from "../../../lib/db/characters.js";
import { setMultiview } from "../../../lib/db/multiview.js";
import { parseCharacterIds } from "../../../lib/api/json.js";
export async function PUT(req: NextRequest) {
  const ids = parseCharacterIds(await req.json().catch(() => null));
  if (ids === null || ids.length === 0) return NextResponse.json({ error: "characterIds required" }, { status: 400 });
  // Every id must be a stored character — otherwise the INSERT would fail its FK with an unhandled
  // 500 instead of a clean 400.
  const known = new Set((await listCharacters()).map((c) => c.id));
  if (ids.some((id) => !known.has(id))) return NextResponse.json({ error: "unknown character" }, { status: 400 });
  await setMultiview(ids);
  return new NextResponse(null, { status: 204 });
}
