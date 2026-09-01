import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { replaceClones, type ClonesWrite, type JumpCloneRow } from "../../lib/db/character-clones.js";

export const CLONES_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const CLONES_RETRY_MS = 15 * 60 * 1000;
const CLONES_SCOPE = "esi-clones.read_clones.v1";
const IMPLANTS_SCOPE = "esi-clones.read_implants.v1";

interface EsiJumpClone { jump_clone_id: number; location_id: number; location_type: string; name?: string; implants: number[] }
interface EsiClones {
  home_location?: { location_id?: number; location_type?: string };
  jump_clones?: EsiJumpClone[];
  last_clone_jump_date?: string;
  last_station_change_date?: string;
}

export interface ClonesJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceClones: (characterId: number, w: ClonesWrite) => Promise<number>;
}

const date = (v: string | undefined): Date | null => (v === undefined ? null : new Date(v));

function toJumpClone(c: EsiJumpClone): JumpCloneRow {
  return {
    jumpCloneId: c.jump_clone_id, locationId: c.location_id ?? null,
    locationType: c.location_type ?? null, name: c.name ?? null, implants: c.implants ?? [],
  };
}

export function createClonesJob(deps: ClonesJobDeps): CharacterSyncJob {
  return {
    name: "clones",
    intervalMs: CLONES_INTERVAL_MS,
    retryMs: CLONES_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      const canClones = hasScope(character, CLONES_SCOPE);
      const canImplants = hasScope(character, IMPLANTS_SCOPE);
      if (!canClones && !canImplants) return 0;

      let clones: ClonesWrite["clones"] = null;
      if (canClones) {
        // home_location is optional as a whole and both of its fields are optional too.
        const data = (await esi.get<EsiClones>(`/characters/${characterId}/clones`, { characterId })).data;
        clones = {
          homeLocationId: data.home_location?.location_id ?? null,
          homeLocationType: data.home_location?.location_type ?? null,
          lastCloneJumpDate: date(data.last_clone_jump_date),
          lastStationChangeDate: date(data.last_station_change_date),
          jumpClones: (data.jump_clones ?? []).map(toJumpClone),
        };
      }
      // /implants is a bare int64[] on a different scope, so it is always a second request.
      const implants = canImplants
        ? (await esi.get<number[]>(`/characters/${characterId}/implants`, { characterId })).data
        : null;

      return deps.replaceClones(characterId, { clones, implants });
    },
  };
}

export const clonesJob: CharacterSyncJob = createClonesJob({ getCharacter, replaceClones });
