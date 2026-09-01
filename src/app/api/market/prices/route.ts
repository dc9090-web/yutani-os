import { NextResponse, type NextRequest } from "next/server";
import { parseIdList } from "../../../../lib/api/json.js";
import { getPrices, stalePriceIds, upsertJitaPrices } from "../../../../lib/db/market-prices.js";
import { FUZZWORK_CHUNK, fetchAggregates } from "../../../../lib/market/fuzzwork.js";

/** Spec §6's "chunks ≤ 500" — one outbound Fuzzwork request per API call, at most. */
const MAX_IDS = FUZZWORK_CHUNK;
const MAX_AGE_HOURS = 24;

export async function GET(req: NextRequest) {
  const ids = parseIdList(req.nextUrl.searchParams.get("ids"), MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const stale = await stalePriceIds(ids, MAX_AGE_HOURS);
  if (stale.length > 0) {
    try {
      const rows = await fetchAggregates(stale);
      if (rows.length > 0) await upsertJitaPrices(rows);
    } catch (e) {
      // Fuzzwork has no SLA (phase 4b, spec §3). Degrade to whatever is stored — at worst ESI's
      // adjusted price, which `priceOf` already falls back to — rather than failing the request.
      console.error("[market] Fuzzwork top-up failed", e);
    }
  }

  const prices = await getPrices(ids);
  return NextResponse.json({ prices: Object.fromEntries(prices) });
}
