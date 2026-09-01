import { NextResponse, type NextRequest } from "next/server";
import { createFit, listFits } from "../../../lib/db/fits.js";
import { parseFitCreate } from "../../../lib/fits/parse.js";

export async function GET() {
  return NextResponse.json({ fits: await listFits() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const input = parseFitCreate(body);
  if (input === null) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json({ fit: await createFit(input) }, { status: 201 });
}
