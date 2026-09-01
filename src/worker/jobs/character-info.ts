import type { SyncJob } from "../scheduler.js";
import { updateCharacterInfo } from "../../lib/db/characters.js";

interface CharacterPublic { name: string; corporation_id: number; alliance_id?: number }
interface Named { name: string }

export const characterInfoJob: SyncJob = {
  name: "character-info",
  intervalMs: 6 * 60 * 60 * 1000,
  async run({ characterId, esi }) {
    const me = (await esi.get<CharacterPublic>(`/characters/${characterId}`, { characterId })).data;
    const corp = (await esi.get<Named>(`/corporations/${me.corporation_id}`)).data;
    const ally = me.alliance_id ? (await esi.get<Named>(`/alliances/${me.alliance_id}`)).data : null;
    await updateCharacterInfo(characterId, { name: me.name, corporationId: me.corporation_id, corporationName: corp.name, allianceId: me.alliance_id ?? null, allianceName: ally?.name ?? null });
    return 1;
  },
};
