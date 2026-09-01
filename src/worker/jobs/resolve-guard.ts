import { EsiError, EsiUnavailableError } from "../../lib/esi/client.js";
import { NeedsReauthError } from "../../lib/esi/tokens.js";

/**
 * True for errors from resolveLocations that a sync job must NOT swallow: an ESI outage
 * (EsiUnavailableError), a token the scheduler needs to re-authorise (NeedsReauthError, thrown
 * by TokenStore before any request even leaves the process), or a 401 (the token was rejected by
 * ESI itself). All three need to reach the scheduler's error handling — EsiUnavailableError and
 * NeedsReauthError are recognised directly, and an EsiError(401) drives markNeedsReauth — so a
 * job's warn-and-continue wrapper around resolveLocations must rethrow these instead of logging
 * and returning as if the run succeeded. Anything else (an ordinary ESI error resolving a single
 * location) is safe to log and skip: the location data itself was already written, and the next
 * run's resolveLocations call retries the name lookup.
 */
export function isAuthOrOutage(e: unknown): boolean {
  return e instanceof EsiUnavailableError || e instanceof NeedsReauthError || (e instanceof EsiError && e.status === 401);
}
