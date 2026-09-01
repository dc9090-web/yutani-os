import type { CharacterSyncJob } from "../scheduler.js";
import { hasScope } from "../../lib/auth/sso.js";
import { getCharacter } from "../../lib/db/characters.js";
import { upsertLocation, type LocationInput } from "../../lib/db/character-location.js";
import { resolveLocations } from "../../lib/names/index.js";

/**
 * 15 minutes, not the 5-second ESI cache: this answers "where is my character" on the Overview,
 * it is not live tracking, and polling a 5 s route on a timer risks a ban.
 */
export const LOCATION_INTERVAL_MS = 15 * 60 * 1000;
export const LOCATION_RETRY_MS = 5 * 60 * 1000;
const LOCATION_SCOPE = "esi-location.read_location.v1";
const SHIP_SCOPE = "esi-location.read_ship_type.v1";
const ONLINE_SCOPE = "esi-location.read_online.v1";

interface EsiLocation { solar_system_id: number; station_id?: number; structure_id?: number }
interface EsiShip { ship_item_id: number; ship_name: string; ship_type_id: number }
interface EsiOnline { online: boolean; last_login?: string; last_logout?: string; logins?: number }

export interface LocationJobDeps {
  getCharacter: (id: number) => Promise<{ scopes: string[] } | null>;
  upsertLocation: (characterId: number, loc: LocationInput) => Promise<number>;
  resolveLocations: (locationIds: number[], characterId: number) => Promise<unknown>;
}

const date = (v: string | undefined): Date | null => (v === undefined ? null : new Date(v));

export function createLocationJob(deps: LocationJobDeps): CharacterSyncJob {
  return {
    name: "location",
    intervalMs: LOCATION_INTERVAL_MS,
    retryMs: LOCATION_RETRY_MS,
    async run({ characterId, esi }) {
      const character = await deps.getCharacter(characterId);
      const canLocation = hasScope(character, LOCATION_SCOPE);
      const canShip = hasScope(character, SHIP_SCOPE);
      const canOnline = hasScope(character, ONLINE_SCOPE);
      if (!canLocation && !canShip && !canOnline) return 0;

      // Exactly one of station_id / structure_id is present when docked; neither when in space.
      const location = canLocation
        ? (await esi.get<EsiLocation>(`/characters/${characterId}/location`, { characterId })).data
        : null;
      const ship = canShip
        ? (await esi.get<EsiShip>(`/characters/${characterId}/ship`, { characterId })).data
        : null;
      const online = canOnline
        ? (await esi.get<EsiOnline>(`/characters/${characterId}/online`, { characterId })).data
        : null;

      const rows = await deps.upsertLocation(characterId, {
        solarSystemId: location?.solar_system_id ?? null,
        stationId: location?.station_id ?? null,
        structureId: location?.structure_id ?? null,
        shipItemId: ship?.ship_item_id ?? null,
        shipTypeId: ship?.ship_type_id ?? null,
        shipName: ship?.ship_name ?? null,
        online: online?.online ?? null,
        lastLogin: date(online?.last_login),
        lastLogout: date(online?.last_logout),
      });

      // The Overview shows a docked-at label, which needs the station/citadel name resolved.
      const docked = location?.station_id ?? location?.structure_id;
      if (docked !== undefined) await deps.resolveLocations([docked], characterId);
      return rows;
    },
  };
}

export const locationJob: CharacterSyncJob = createLocationJob({ getCharacter, upsertLocation, resolveLocations });
