import { listAssets, type AssetRow } from "../db/character-assets.js";
import { listFittings, type FittingRow } from "../db/character-fittings.js";
import { listSkills } from "../db/character-skills.js";
import { listImplants } from "../db/character-clones.js";
import { loadDogmaData } from "../dogma/sde-loader.js";
import type { FitContext } from "../dogma/index.js";

export interface FitData {
  assets: AssetRow[];
  fittings: FittingRow[];
  ctx: FitContext;
  /** False when phase 3 has not synced skills yet — spec §6 wants the page to say so. */
  skillsSynced: boolean;
}

/**
 * Everything the Ships pages need, in four repo reads and **one** `loadDogmaData` call (spec §4's
 * batching rule; phase 4a's loader memoises attributes, effects and groups process-wide and types
 * per id, so a second call in the same request would be waste, not breakage).
 *
 * The id set is exactly what phase 4a asks for: every asset type, every saved-fit hull and item,
 * every trained skill and every implant. The loader adds the transitive `requiredSkillN` closure
 * itself, so the recursive missing-skill expansion always has the types it needs.
 *
 * Trained level, not active level: the sheet answers "can I fly this", and an unplugged clone does
 * not untrain a skill.
 */
export async function loadFitData(characterId: number): Promise<FitData> {
  const [assets, fittings, skills, implants] = await Promise.all([
    listAssets(characterId),
    listFittings(characterId),
    listSkills(characterId),
    listImplants(characterId),
  ]);

  const typeIds = new Set<number>();
  for (const asset of assets) typeIds.add(asset.typeId);
  for (const fitting of fittings) {
    typeIds.add(fitting.shipTypeId);
    for (const item of fitting.items) typeIds.add(item.typeId);
  }
  for (const skill of skills) typeIds.add(skill.skillId);
  for (const implant of implants) typeIds.add(implant);

  const data = await loadDogmaData([...typeIds]);
  return {
    assets,
    fittings,
    skillsSynced: skills.length > 0,
    ctx: { data, skills: new Map(skills.map((s) => [s.skillId, s.trainedLevel])), implants },
  };
}
