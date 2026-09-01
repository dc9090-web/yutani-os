import { NextResponse } from "next/server";
import { listMarketGroups } from "../../../../lib/sde/repo.js";

/** The tree changes only when the SDE is re-imported; the client keeps it for a day. */
export async function GET() {
  return NextResponse.json({ groups: await listMarketGroups() }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
