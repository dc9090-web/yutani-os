import type { CharacterSyncJob } from "../scheduler.js";
import { updateCharacterInfo } from "../../lib/db/characters.js";

export const CHARACTER_INFO_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const CHARACTER_INFO_RETRY_MS = 15 * 60 * 1000;

interface CharacterPublic { name: string; corporation_id: number; alliance_id?: number; race_id?: number }
interface Named { name: string }

export const characterInfoJob: CharacterSyncJob = {
  name: "character-info",
  intervalMs: CHARACTER_INFO_INTERVAL_MS,
  retryMs: CHARACTER_INFO_RETRY_MS,
  async run({ characterId, esi }) {
    const me = (await esi.get<CharacterPublic>(`/characters/${characterId}`, { characterId })).data;
    const corp = (await esi.get<Named>(`/corporations/${me.corporation_id}`)).data;
    const ally = me.alliance_id ? (await esi.get<Named>(`/alliances/${me.alliance_id}`)).data : null;
    await updateCharacterInfo(characterId, { name: me.name, corporationId: me.corporation_id, corporationName: corp.name, allianceId: me.alliance_id ?? null, allianceName: ally?.name ?? null, raceId: me.race_id ?? null });
    return 1;
  },
};
