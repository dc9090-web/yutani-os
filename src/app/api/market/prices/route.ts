import { NextResponse, type NextRequest } from "next/server";
import { parseIdList } from "../../../../lib/api/json.js";
import {
  getPrices, stalePriceIds, touchMissingJitaPrices, upsertJitaPrices,
} from "../../../../lib/db/market-prices.js";
import { FUZZWORK_CHUNK, fetchAggregates } from "../../../../lib/market/fuzzwork.js";

/** Spec §6's "chunks ≤ 500" — one outbound Fuzzwork request per API call, at most. */
const MAX_IDS = FUZZWORK_CHUNK;
const MAX_AGE_HOURS = 24;
/** Fuzzwork has no SLA (phase 4b, spec §3); an editor page load must not hang on it. */
const FUZZWORK_TIMEOUT_MS = 3000;

// AbortSignal.timeout is not part of `fetchImpl`'s `typeof fetch` parameters, so it is injected
// the same way the user agent is — a thin wrapper around the real `fetch`.
const withTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(FUZZWORK_TIMEOUT_MS) });

export async function GET(req: NextRequest) {
  const ids = parseIdList(req.nextUrl.searchParams.get("ids"), MAX_IDS);
  if (ids === null) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const stale = await stalePriceIds(ids, MAX_AGE_HOURS);
  if (stale.length > 0) {
    try {
      const rows = await fetchAggregates(stale, withTimeout);
      if (rows.length > 0) await upsertJitaPrices(rows);
      // A stale id Fuzzwork's response left out entirely (as opposed to answering an explicit
      // no-orders shape, which `fetchAggregates` already turns into a null-valued row) would
      // otherwise come back stale on every future call, hitting Fuzzwork for it forever.
      const missing = stale.filter((id) => !rows.some((r) => r.typeId === id));
      if (missing.length > 0) await touchMissingJitaPrices(missing);
    } catch (e) {
      // Degrade to whatever is stored — at worst ESI's adjusted price, which `priceOf` already
      // falls back to — rather than failing the request.
      console.error("[market] Fuzzwork top-up failed", e);
    }
  }

  const prices = await getPrices(ids);
  return NextResponse.json({ prices: Object.fromEntries(prices) });
}
