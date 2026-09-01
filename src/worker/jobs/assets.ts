import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { chunk } from "../../lib/chunk.js";
import { getCharacter } from "../../lib/db/characters.js";
import { replaceAssets, type AssetRow } from "../../lib/db/character-assets.js";
import { resolveLocations } from "../../lib/names/index.js";

export const ASSETS_INTERVAL_MS = 60 * 60 * 1000;
export const ASSETS_RETRY_MS = 10 * 60 * 1000;
export const ASSET_NAMES_CHUNK = 1000;                   // ESI: maxItems 1000, uniqueItems true
const ASSETS_SCOPE = "esi-assets.read_assets.v1";

interface EsiAsset {
  item_id: number; type_id: number; quantity: number; location_id: number;
  location_type: string; location_flag: string; is_singleton: boolean; is_blueprint_copy?: boolean;
}
interface EsiAssetName { item_id: number; name: string }

export interface AssetsJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  replaceAssets: (characterId: number, assets: AssetRow[]) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}

export function createAssetsJob(deps: AssetsJobDeps): CharacterSyncJob {
  return {
    name: "assets",
    intervalMs: ASSETS_INTERVAL_MS,
    retryMs: ASSETS_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      if (!hasScope(character, ASSETS_SCOPE)) return 0;

      // getAll enforces the Last-Modified consistency check; assets change constantly.
      const raw = await esi.getAll<EsiAsset>(`/characters/${characterId}/assets`, { characterId });

      // Only singletons can carry a custom name; a stack just echoes the type name back.
      const singletons = [...new Set(raw.filter((a) => a.is_singleton).map((a) => a.item_id))];
      const names = new Map<number, string>();
      for (const batch of chunk(singletons, ASSET_NAMES_CHUNK)) {
        const named = await esi.post<EsiAssetName[]>(`/characters/${characterId}/assets/names`, batch, { characterId });
        for (const n of named) names.set(n.item_id, n.name);
      }

      const rows: AssetRow[] = raw.map((a) => ({
        itemId: a.item_id, typeId: a.type_id, quantity: a.quantity, locationId: a.location_id,
        locationType: a.location_type, locationFlag: a.location_flag, isSingleton: a.is_singleton,
        // ESI only ever sends `true`; absent means "not a blueprint copy". Never compare with false.
        isBlueprintCopy: a.is_blueprint_copy === true,
        name: names.get(a.item_id) ?? null,
      }));
      const written = await deps.replaceAssets(characterId, rows);

      // Roots are the assets that are not nested inside another item: stations, systems, citadels.
      const roots = [...new Set(raw.filter((a) => a.location_type !== "item").map((a) => a.location_id))];
      await deps.resolveLocations(roots, characterId);
      return written;
    },
  };
}

export const assetsJob: CharacterSyncJob = createAssetsJob({ getCharacter, replaceAssets, resolveLocations });
