/**
 * Fitting-window statistics: the three resource gauges, slot and hardpoint counters, and one row per
 * fitted module. See spec §2.4 and research §5.3/§5.4.
 */
import { ATTR, EFFECT, State, type AttrId } from "./data.js";
import { getAttr } from "./calc.js";
import { round2 } from "./operators.js";
import {
  HARDPOINTS, SLOT_KINDS, hardpointOf, type Fit, type Hardpoint, type Item, type SlotKind,
} from "./fit.js";

export interface ResourcePool { used: number; output: number }
export interface SlotUsage { used: number; total: number }

export interface ModuleStat {
  item: Item;
  slot: SlotKind;
  index: number;
  /** The amount actually charged — 0 when the online gate is closed. */
  cpu: number;
  power: number;
  calibration: number;
  state: State;
  charged: boolean;
}

export interface FitStats {
  cpu: ResourcePool;
  power: ResourcePool;
  calibration: ResourcePool;
  slots: Record<SlotKind, SlotUsage>;
  hardpoints: Record<Hardpoint, SlotUsage>;
  modules: ModuleStat[];
}

const SLOT_ATTRS: Record<SlotKind, AttrId> = {
  high: ATTR.hiSlots, mid: ATTR.medSlots, low: ATTR.lowSlots,
  rig: ATTR.rigSlots, subsystem: ATTR.maxSubSystems,
};

const HARDPOINT_ATTRS: Record<Hardpoint, AttrId> = {
  turret: ATTR.turretSlots, launcher: ATTR.launcherSlots,
};

export function fitStats(fit: Fit): FitStats {
  const modules: ModuleStat[] = [];
  let cpuUsed = 0;
  let powerUsed = 0;
  let calibrationUsed = 0;

  for (const { item, slot, index } of fit.modules) {
    // EOS's rule: a module consumes CPU/PG only while its own `online` effect can run.
    const charged = item.state >= State.Online && item.effects.has(EFFECT.online);
    const cpu = charged ? getAttr(fit, item, ATTR.cpu) : 0;
    const power = charged ? getAttr(fit, item, ATTR.power) : 0;
    // Rigs pay calibration in every state, including offline — `rigSlot` is a passive effect.
    // Keyed on `slot === "rig"` (derived from the ESI location flag / marker effect at build time),
    // not on the `rigSlot` effect (2663) as EOS does — a deliberate, recorded deviation.
    const calibration = slot === "rig" ? getAttr(fit, item, ATTR.upgradeCost) : 0;
    cpuUsed += cpu;
    powerUsed += power;
    calibrationUsed += calibration;
    modules.push({ item, slot, index, cpu, power, calibration, state: item.state, charged });
  }

  const slots = {} as Record<SlotKind, SlotUsage>;
  for (const kind of SLOT_KINDS) {
    let total = Math.floor(getAttr(fit, fit.ship, SLOT_ATTRS[kind]));
    // EVE went from five subsystems to four; the SDE attribute was never changed to match.
    if (kind === "subsystem" && total === 5) total = 4;
    slots[kind] = { used: fit.modules.filter((m) => m.slot === kind).length, total };
  }

  const hardpoints = {} as Record<Hardpoint, SlotUsage>;
  for (const kind of HARDPOINTS) {
    hardpoints[kind] = {
      // Regardless of state: an offline turret still occupies its hardpoint.
      used: fit.modules.filter((m) => hardpointOf(m.item) === kind).length,
      total: Math.floor(getAttr(fit, fit.ship, HARDPOINT_ATTRS[kind])),
    };
  }

  return {
    cpu: { used: round2(cpuUsed), output: getAttr(fit, fit.ship, ATTR.cpuOutput) },
    power: { used: round2(powerUsed), output: getAttr(fit, fit.ship, ATTR.powerOutput) },
    calibration: { used: round2(calibrationUsed), output: getAttr(fit, fit.ship, ATTR.upgradeCapacity) },
    slots,
    hardpoints,
    modules,
  };
}
