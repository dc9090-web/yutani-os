import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { fitFromAssetShip } from "../../../../lib/fits/clone.js";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const characterId = (body as { characterId?: unknown } | null)?.characterId;
  const itemId = (body as { itemId?: unknown } | null)?.itemId;
  if (!positive(characterId) || !positive(itemId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const outcome = await fitFromAssetShip(characterId, itemId);
  if (outcome.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (outcome.kind === "failed") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: [] }, { status: 201 });
}
