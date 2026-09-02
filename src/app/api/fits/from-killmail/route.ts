import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../lib/db/characters.js";
import { fitFromKillmail } from "../../../../lib/combat/fit.js";

const positive = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const killmailId = (body as { killmailId?: unknown } | null)?.killmailId;
  const rawCharacter = (body as { characterId?: unknown } | null)?.characterId;
  if (!positive(killmailId) || (rawCharacter !== undefined && !positive(rawCharacter))) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // No character means the phase-5 "All skills V" pilot, exactly like an EFT import.
  const characterId = rawCharacter === undefined ? null : rawCharacter;
  if (characterId !== null && (await getCharacter(characterId)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const outcome = await fitFromKillmail(killmailId, characterId);
  if (outcome.kind === "notFound") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (outcome.kind === "failed") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: [] }, { status: 201 });
}
