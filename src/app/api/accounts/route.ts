import { NextResponse, type NextRequest } from "next/server";
import { createAccount, listAccounts } from "../../../lib/db/accounts.js";
import { parseName } from "../../../lib/api/json.js";
export async function GET() { return NextResponse.json(await listAccounts()); }
export async function POST(req: NextRequest) {
  const name = parseName(await req.json().catch(() => null));
  if (!name) return NextResponse.json({ error: "name required (1-40 chars)" }, { status: 400 });
  try { return NextResponse.json(await createAccount(name), { status: 201 }); }
  catch { return NextResponse.json({ error: "an account with that name exists" }, { status: 409 }); }
}
