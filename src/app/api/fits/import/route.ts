import { NextResponse, type NextRequest } from "next/server";
import { fitFromEftText } from "../../../../lib/fits/clone.js";

/** A pasted fit is a few hundred bytes; 100 kB is a runaway paste, not a fit. */
const MAX_TEXT = 100_000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || text.trim() === "" || text.length > MAX_TEXT) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const outcome = await fitFromEftText(text);
  if (outcome.kind !== "ok") {
    return NextResponse.json({ error: "could not build the fit" }, { status: 400 });
  }
  return NextResponse.json({ fit: outcome.fit, unresolved: outcome.unresolved }, { status: 201 });
}
