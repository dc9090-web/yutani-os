/**
 * The plan editor as plain strings and numbers (spec §5). Pure: the server component renders it
 * and the client recomputes it on every edit, so the two can never diverge.
 */
import { skillLabel, type SkillCatalogue } from "../skills/catalogue.js";
import { ATTRIBUTE_KEY_BY_ATTR, ATTRIBUTE_KEYS, type AttributeKey, type AttributeSet } from "../skills/attributes.js";
import type { RemapResult } from "../skills/remap.js";
import type { PlanStatus, Timeline } from "../skills/timeline.js";
import { duration, grouped, roman, sp as spLabel, stamp } from "./format.js";
import { ATTRIBUTE_LABEL, remapAvailability } from "./skills.js";

const STATUS_LABEL: Record<PlanStatus, string> = {
  done: "Done", queued: "In queue", planned: "Planned",
};

export interface PlanRowView {
  position: number; skillId: number; skill: string; group: string | null;
  level: string; levelNumber: number; rank: string;
  sp: string; time: string; cumulative: string; doneAt: string;
  status: PlanStatus; statusLabel: string; prereq: boolean; alpha: boolean;
  note: string | null; unknown: boolean;
  /** Index into the STORED entries, or null for a row the expansion inserted. */
  entryIndex: number | null;
}
export interface PlanTotalsView { entries: number; remaining: number; sp: string; time: string; doneAt: string }
export interface PlanViewModel { rows: PlanRowView[]; totals: PlanTotalsView; unknownCount: number }

export function planView(
  timeline: Timeline, catalogue: SkillCatalogue,
  requested: readonly { skillId: number; level: number }[] = [],
): PlanViewModel {
  const byPair = new Map(requested.map((e, i) => [`${e.skillId}:${e.level}`, i]));
  const rows = timeline.entries.map((entry, index): PlanRowView => {
    const skill = catalogue.get(entry.skillId);
    const costs = entry.status === "planned" && entry.ms > 0;
    return {
      position: index + 1,
      skillId: entry.skillId,
      skill: skillLabel(catalogue, entry.skillId),
      group: skill?.groupName ?? null,
      level: roman(entry.level),
      levelNumber: entry.level,
      rank: skill === undefined ? "—" : `×${skill.rank}`,
      sp: entry.levelSp === 0 ? "—" : spLabel(entry.levelSp),
      time: costs ? duration(entry.ms) : "—",
      cumulative: costs ? duration(entry.cumulativeMs) : "—",
      doneAt: costs ? stamp(entry.doneAt) : "—",
      status: entry.status,
      statusLabel: STATUS_LABEL[entry.status],
      prereq: entry.prereq,
      alpha: skill?.alphaMaxLevel != null && entry.level <= skill.alphaMaxLevel,
      note: entry.note,
      unknown: skill === undefined,
      entryIndex: byPair.get(`${entry.skillId}:${entry.level}`) ?? null,
    };
  });
  return {
    rows,
    totals: {
      entries: rows.length,
      remaining: rows.filter((r) => r.status === "planned").length,
      sp: spLabel(timeline.totalSp),
      time: duration(timeline.totalMs),
      doneAt: stamp(timeline.doneAt),
    },
    unknownCount: timeline.unknownSkillIds.length,
  };
}

export interface AttributeRowView { key: AttributeKey; label: string; base: number; bonus: number; total: number }
export interface AttributePairView { label: string; spPerHour: string; entries: number }
export interface AttributePanelInput {
  base: AttributeSet; implantBonus: AttributeSet; effective: AttributeSet;
  bonusRemaps: number | null; accruedRemapCooldownDate: Date | null; attributesSane: boolean;
  timeline: Timeline; catalogue: SkillCatalogue; now: Date;
}
export interface AttributePanelView {
  attributes: AttributeRowView[]; pairs: AttributePairView[];
  remapAvailable: string | null; bonusRemaps: number | null; sane: boolean;
}

export function attributePanel(input: AttributePanelInput): AttributePanelView {
  const attributes = ATTRIBUTE_KEYS.map((key): AttributeRowView => ({
    key, label: ATTRIBUTE_LABEL[key],
    base: input.base[key], bonus: input.implantBonus[key], total: input.effective[key],
  }));

  // One rate row per attribute pair the REMAINING work uses, in first-appearance order.
  const pairs = new Map<string, AttributePairView>();
  for (const entry of input.timeline.entries) {
    if (entry.status !== "planned") continue;
    const skill = input.catalogue.get(entry.skillId);
    if (skill === undefined) continue;
    const primary = ATTRIBUTE_KEY_BY_ATTR.get(skill.primaryAttr);
    const secondary = ATTRIBUTE_KEY_BY_ATTR.get(skill.secondaryAttr);
    if (primary === undefined || secondary === undefined) continue;
    const label = `${ATTRIBUTE_LABEL[primary]} / ${ATTRIBUTE_LABEL[secondary]}`;
    const existing = pairs.get(label);
    if (existing) existing.entries += 1;
    else pairs.set(label, { label, spPerHour: `${grouped(entry.spPerMinute * 60)} SP/h`, entries: 1 });
  }

  return {
    attributes,
    pairs: [...pairs.values()],
    remapAvailable: remapAvailability(
      { bonusRemaps: input.bonusRemaps, accruedRemapCooldownDate: input.accruedRemapCooldownDate },
      input.now),
    bonusRemaps: input.bonusRemaps,
    sane: input.attributesSane,
  };
}

export interface RemapDeltaView { key: AttributeKey; label: string; from: number; to: number; delta: string }
export interface RemapSuggestionView {
  deltas: RemapDeltaView[]; totalTime: string; currentTime: string; saved: string; alreadyOptimal: boolean;
}

export function remapSuggestion(currentBase: AttributeSet, result: RemapResult): RemapSuggestionView {
  return {
    deltas: ATTRIBUTE_KEYS.map((key) => {
      const from = currentBase[key];
      const to = result.remap[key];
      const change = to - from;
      return { key, label: ATTRIBUTE_LABEL[key], from, to, delta: change > 0 ? `+${change}` : String(change) };
    }),
    totalTime: duration(result.totalMs),
    currentTime: duration(result.currentMs),
    saved: duration(result.savedMs),
    alreadyOptimal: result.savedMs === 0,
  };
}
