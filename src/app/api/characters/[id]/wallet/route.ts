import { NextResponse, type NextRequest } from "next/server";
import { getCharacter } from "../../../../../lib/db/characters.js";
import { parseId } from "../../../../../lib/api/json.js";
import { loadJournalViews, loadTransactionViews } from "../../../../../lib/view/wallet.js";

type Ctx = { params: Promise<{ id: string }> };

/** Absent offset means the first page; anything that is not a non-negative integer is a 400. */
function parseOffset(raw: string | null): number | null {
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const id = parseId((await params).id);
  const kind = req.nextUrl.searchParams.get("kind");
  const offset = parseOffset(req.nextUrl.searchParams.get("offset"));
  if (id === null || offset === null || (kind !== "journal" && kind !== "transactions")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if ((await getCharacter(id)) === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Same builders the page uses, so the rows the client appends match the ones already on screen.
  const rows = kind === "journal" ? await loadJournalViews(id, offset) : await loadTransactionViews(id, offset);
  return NextResponse.json({ rows });
}
