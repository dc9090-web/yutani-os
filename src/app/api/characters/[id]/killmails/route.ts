import { NextResponse, type NextRequest } from "next/server";
import { getCharacter, listCharacters } from "../../../../../lib/db/characters.js";
import { parseId } from "../../../../../lib/api/json.js";
import { parsePeriod } from "../../../../../lib/combat/stats.js";
import { loadKillmailRows } from "../../../../../lib/combat/load.js";

type Ctx = { params: Promise<{ id: string }> };

/** Absent offset means the first page; anything that is not a non-negative integer is a 400. */
function parseOffset(raw: string | null): number | null {
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  if (id === null || offset === null) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(id)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const period = parsePeriod(req.nextUrl.searchParams.get("period"));
  // The All-characters toggle travels with the request so an appended page matches the tab.
  const all = req.nextUrl.searchParams.get("all") === "1";
  const characterIds = all ? (await listCharacters()).map((c) => c.id) : [id];
  // Same builders the page uses, so the rows the client appends match the ones already on screen.
  return NextResponse.json(await loadKillmailRows(characterIds, period, offset));
}
