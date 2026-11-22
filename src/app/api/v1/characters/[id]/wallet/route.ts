import { walletRowsResource, walletSummaryResource } from "../../../../../../lib/api/v1/resources.js";
import { v1Error } from "../../../../../../lib/api/v1/respond.js";
import { pathCharacter, v1Get } from "../../../../../../lib/api/v1/route.js";
import { WALLET_MAX_LIMIT } from "../../../../../../lib/pages/wallet.js";

/** Absent means `fallback`; anything that is not an integer in [min, max] is a 400. */
function parseInt10(raw: string | null, fallback: number, min: number, max: number): number | null {
  if (raw === null) return fallback;
  const value = Number(raw);
  return raw.trim() !== "" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * No `kind`: the balance above the lists. `kind=journal|transactions`: a slice of that list,
 * `offset` (default 0) and `limit` (default 100, at most 500) rows in, newest first.
 */
export const GET = v1Get<{ id: string }>(async ({ req, params }) => {
  const id = await pathCharacter(params.id);
  if (typeof id !== "number") return id;
  const query = req.nextUrl.searchParams;
  const kind = query.get("kind");
  if (kind === null) return walletSummaryResource(id);
  const offset = parseInt10(query.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = parseInt10(query.get("limit"), 100, 1, WALLET_MAX_LIMIT);
  if ((kind !== "journal" && kind !== "transactions") || offset === null || limit === null) return v1Error(400, "bad-request");
  return walletRowsResource(id, kind, offset, limit);
});
