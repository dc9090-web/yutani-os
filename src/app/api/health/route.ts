import { NextResponse } from "next/server";
import { getPool } from "../../../lib/db/client.js";
export async function GET() {
  try { await getPool().query("SELECT 1"); return NextResponse.json({ ok: true, db: true }); }
  catch { return NextResponse.json({ ok: false, db: false }, { status: 503 }); }
}
