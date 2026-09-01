import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { replaceFittings, type FittingRow } from "../../lib/db/character-fittings.js";

export const FITTINGS_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const FITTINGS_RETRY_MS = 15 * 60 * 1000;
const FITTINGS_SCOPE = "esi-fittings.read_fittings.v1";

interface EsiFittingItem { type_id: number; quantity: number; flag: string }
interface EsiFitting { fitting_id: number; name: string; description: string; ship_type_id: number; items: EsiFittingItem[] }

export interface FittingsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceFittings: (characterId: number, fittings: FittingRow[]) => Promise<number>;
}

export function createFittingsJob(deps: FittingsJobDeps): CharacterSyncJob {
  return {
    name: "fittings",
    intervalMs: FITTINGS_INTERVAL_MS,
    retryMs: FITTINGS_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, FITTINGS_SCOPE)) return 0;
      const data = (await esi.get<EsiFitting[]>(`/characters/${characterId}/fittings`, { characterId })).data;
      // Items keep their ESI array order via idx; `flag` may legitimately be "Invalid".
      const fittings: FittingRow[] = data.map((f) => ({
        fittingId: f.fitting_id, name: f.name, description: f.description, shipTypeId: f.ship_type_id,
        items: (f.items ?? []).map((i, idx) => ({ idx, typeId: i.type_id, quantity: i.quantity, flag: i.flag })),
      }));
      return deps.replaceFittings(characterId, fittings);
    },
  };
}

export const fittingsJob: CharacterSyncJob = createFittingsJob({ getCharacter, replaceFittings });
