import type { CharacterSyncJob, JobOutcome } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { EsiError } from "../../lib/esi/client.js";
import { getCharacter } from "../../lib/db/characters.js";
import { knownKillmailIds, saveKillmails } from "../../lib/db/killmails.js";
import {
  partyIds, roleFor, toKillmailWrite,
  type CharacterKillmailLink, type EsiKillmail, type KillmailWrite,
} from "../../lib/combat/killmail.js";
import { resolveNames } from "../../lib/names/index.js";
import { isAuthOrOutage } from "./resolve-guard.js";

export const KILLMAILS_INTERVAL_MS = 60 * 60 * 1000;
export const KILLMAILS_RETRY_MS = 10 * 60 * 1000;
export const KILLMAILS_SCOPE = "esi-killmails.read_killmails.v1";
/**
 * `/killmails/recent` lives in the `char-killmail` bucket — 30 tokens / 15 min, the tightest in the
 * app (research §6). Ten pages an hour per character stays comfortably inside it, and the early
 * stop means a settled character normally spends exactly one.
 */
export const MAX_KILLMAIL_PAGES = 10;

export interface EsiKillmailRef { killmail_id: number; killmail_hash: string }

export interface KillmailsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  knownKillmailIds: (ids: number[]) => Promise<Set<number>>;
  saveKillmails: (writes: KillmailWrite[], links: CharacterKillmailLink[]) => Promise<number>;
  resolveNames: (ids: number[]) => Promise<unknown>;
}

export function createKillmailsJob(deps: KillmailsJobDeps): CharacterSyncJob {
  return {
    name: "killmails",
    intervalMs: KILLMAILS_INTERVAL_MS,
    retryMs: KILLMAILS_RETRY_MS,
    async run({ characterId, esi }): Promise<number | JobOutcome> {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, KILLMAILS_SCOPE)) return 0;

      const writes: KillmailWrite[] = [];
      const links: CharacterKillmailLink[] = [];
      const parties = new Set<number>();
      // Set when a later page 403s, so pages 1..N-1's writes/links below are still saved and
      // reported instead of being thrown away by an early return (they were already fetched and
      // paid for in ESI calls — discarding them would just mean re-fetching them next hour).
      let warn: string | undefined;

      for (let page = 1; page <= MAX_KILLMAIL_PAGES; page++) {
        let refs: EsiKillmailRef[];
        try {
          refs = (await esi.get<EsiKillmailRef[]>(
            `/characters/${characterId}/killmails/recent`, { characterId, page })).data;
        } catch (e) {
          // 403 = the token predates the scope grant. Every character has to log in again after
          // the portal's scope set changed; until then this is a degraded run, not a failed one.
          if (e instanceof EsiError && e.status === 403) {
            warn = "killmail scope not on this token yet — log the character in again (ESI 403)";
            break;
          }
          throw e;
        }
        if (refs.length === 0) break;

        const known = await deps.knownKillmailIds(refs.map((r) => r.killmail_id));
        const fresh = refs.filter((r) => !known.has(r.killmail_id));
        // A whole page we already have means everything older is already stored: killmails are
        // immutable and the list is newest-first, so there is nothing beyond this point to learn.
        if (fresh.length === 0) break;

        for (const r of fresh) {
          // Public route: NO characterId, so no Authorization header, the generous `killmail`
          // bucket (3600/15m) instead of `char-killmail`, and a shared character_id = 0 cache row.
          const body = (await esi.get<EsiKillmail>(
            `/killmails/${r.killmail_id}/${r.killmail_hash}`)).data;
          writes.push(toKillmailWrite(body, r.killmail_hash, "esi"));
          const role = roleFor(body, characterId);
          if (role !== null) links.push({ characterId, killmailId: r.killmail_id, role });
          for (const id of partyIds(body)) parties.add(id);
        }
      }

      const written = await deps.saveKillmails(writes, links);

      // Names are resolved here, not at render time, so the pages stay Postgres-only (Decision 3).
      if (parties.size > 0) {
        try {
          await deps.resolveNames([...parties]);
        } catch (e) {
          if (isAuthOrOutage(e)) throw e;
          // The killmails are already stored; the next run's resolveNames retries the lookup.
          console.warn(`[killmails] name resolution failed for ${characterId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return warn === undefined ? written : { rows: written, warn };
    },
  };
}

export const killmailsJob: CharacterSyncJob = createKillmailsJob({
  getCharacter, knownKillmailIds, saveKillmails, resolveNames,
});
