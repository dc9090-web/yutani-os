/**
 * The drone selector's arithmetic, on plain numbers so it runs in the browser without the dogma
 * engine: the engine has already worked out what one drone of each type does (`DroneSheetView`),
 * and a launched selection is just a sum over those.
 */
export interface DroneOption { typeId: number; name: string; inBay: number; bandwidth: number; dpsEach: number; volleyEach: number }
export interface DroneLimits { types: readonly DroneOption[]; bandwidth: number; maxActive: number | null }
export type Launched = Readonly<Record<number, number>>;

export interface LaunchedTotals { dps: number; volley: number; active: number; bandwidthUsed: number }

export function launchedTotals(limits: DroneLimits, launched: Launched): LaunchedTotals {
  let dps = 0, volley = 0, active = 0, bandwidthUsed = 0;
  for (const type of limits.types) {
    const n = Math.min(launched[type.typeId] ?? 0, type.inBay);
    dps += n * type.dpsEach;
    volley += n * type.volleyEach;
    active += n;
    bandwidthUsed += n * type.bandwidth;
  }
  return { dps, volley, active, bandwidthUsed };
}

/**
 * How many more of `type` can go out on top of `launched`: the lowest of what is left in the bay,
 * what is left of the pilot's drone control limit, and what the remaining bandwidth carries.
 */
export function roomFor(limits: DroneLimits, launched: Launched, type: DroneOption): number {
  const { active, bandwidthUsed } = launchedTotals(limits, launched);
  const byBay = type.inBay - (launched[type.typeId] ?? 0);
  const byControl = limits.maxActive === null ? Infinity : limits.maxActive - active;
  const byBandwidth = type.bandwidth > 0 ? Math.floor((limits.bandwidth - bandwidthUsed + 1e-9) / type.bandwidth) : Infinity;
  return Math.max(0, Math.min(byBay, byControl, byBandwidth));
}

/** "4× Imperial Navy Infiltrator, 1× Hobgoblin II", or "No drones launched". */
export function launchedSummary(limits: DroneLimits, launched: Launched): string {
  const parts = limits.types.flatMap((type) => {
    const n = launched[type.typeId] ?? 0;
    return n > 0 ? [`${n}× ${type.name}`] : [];
  });
  return parts.length === 0 ? "No drones launched" : parts.join(", ");
}
