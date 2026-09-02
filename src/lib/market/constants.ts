/**
 * Isomorphic market constants — no `pg`, no `config.ts`, safe for the client bundle graph.
 * `fuzzwork.ts` re-exports this so the worker/route imports are unchanged; `client-data.ts` (which
 * runs in the browser) imports it from here directly instead of dragging `fuzzwork.ts` — and with it
 * `config.ts` — into the client bundle.
 */

/**
 * Spec §3. The real limit is URI length, not a type count: 1300 ids answered 200 and 2000 earned a
 * `414 Request-URI Too Large` (research §4), so 500 leaves generous headroom.
 */
export const FUZZWORK_CHUNK = 500;
