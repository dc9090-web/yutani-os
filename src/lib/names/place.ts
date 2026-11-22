import { getSolarSystems } from "../sde/repo.js";
import { secClass, secText, type SecView } from "../view/format.js";
import { locationLabels, type LocationLabel } from "./label.js";

/** A place with the solar system it sits in, ready to show the way every page shows a location. */
export interface PlaceView {
  name: string;
  kind: LocationLabel["kind"];
  /** The system's name and its security status, coloured; null when the place resolves to no system. */
  system: SecView | null;
}

/**
 * `locationLabels` plus one solar-system query for the security status of every place asked about.
 * Postgres only. A place that is itself a solar system is its own system.
 */
export async function placeViews(ids: number[]): Promise<Map<number, PlaceView>> {
  const labels = await locationLabels(ids);
  const systems = await getSolarSystems([...new Set([...labels.values()].flatMap((l) => (l.solarSystemId === null ? [] : [l.solarSystemId])))]);
  const out = new Map<number, PlaceView>();
  for (const [id, label] of labels) {
    const system = label.solarSystemId === null ? undefined : systems.get(label.solarSystemId);
    out.set(id, {
      name: label.name, kind: label.kind,
      system: system === undefined ? null : {
        name: system.name ?? `Unknown system (${system.id})`,
        sec: secText(system.securityStatus), secClass: secClass(system.securityStatus),
      },
    });
  }
  return out;
}
