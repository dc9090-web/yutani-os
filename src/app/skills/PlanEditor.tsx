"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconDeviceFloppy, IconFileExport, IconPlus } from "@tabler/icons-react";
import { addAttributes, type AttributeSet } from "../../lib/skills/attributes.js";
import { catalogueFrom, type PlanSkill } from "../../lib/skills/catalogue.js";
import { expandPlan, type PlanEntry } from "../../lib/skills/expand.js";
import { MAX_PLAN_ENTRIES } from "../../lib/skills/parse.js";
import { MAX_SKILL_LEVEL } from "../../lib/skills/sp.js";
import { PLAN_TEXT_FORMATS, type PlanTextFormat } from "../../lib/skills/text.js";
import { planTimeline } from "../../lib/skills/timeline.js";
import { roman, stamp } from "../../lib/view/format.js";
import { attributePanel, planView, remapSuggestion, type RemapSuggestionView } from "../../lib/view/plan.js";
import { AttributesPanel } from "./AttributesPanel.js";
import { PlanTable } from "./PlanTable.js";

/** Spec §5: "Save is explicit (PUT), with autosave 2 s after the last change". */
export const AUTOSAVE_MS = 2000;
const MAX_RESULTS = 30;

export interface PlanEditorContext {
  base: AttributeSet; implantBonus: AttributeSet;
  trained: [number, number][]; queued: [number, number][]; partialSp: [number, number][];
  queueEndsAt: string | null; bonusRemaps: number | null; accruedRemapCooldownDate: string | null;
  attributesSane: boolean; synced: boolean;
}

export interface PlanEditorProps {
  plan: {
    id: number; characterId: number; name: string; remap: AttributeSet | null;
    entries: { skillId: number; level: number; note: string | null }[];
  };
  characterName: string;
  catalogue: PlanSkill[];
  context: PlanEditorContext;
  accountBlock: { name: string; until: string } | null;
  now?: string;
}

interface SavePayload { name: string; entries: PlanEntry[]; remap: AttributeSet | null }

const SAVE_LABELS = {
  idle: "", saving: "Saving…", saved: "Saved",
  error: "Could not save — retrying on the next change",
};

export function PlanEditor({ plan, characterName, catalogue, context, accountBlock, now }: PlanEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [entries, setEntries] = useState<PlanEntry[]>(plan.entries);
  const [remap, setRemap] = useState<AttributeSet | null>(plan.remap);
  const [suggestion, setSuggestion] = useState<RemapSuggestionView | null>(null);
  const [suggested, setSuggested] = useState<AttributeSet | null>(null);
  const [optimising, setOptimising] = useState(false);
  const [afterQueue, setAfterQueue] = useState(false);
  const [afterAccount, setAfterAccount] = useState(false);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<keyof typeof SAVE_LABELS>("idle");
  const [exportFormat, setExportFormat] = useState<PlanTextFormat>("evemon");
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  // Captured once: a `new Date()` in the render would shift every completion time per keystroke.
  const [mountedAt] = useState(() => (now === undefined ? new Date() : new Date(now)));

  const index = useMemo(() => catalogueFrom(catalogue), [catalogue]);
  const trained = useMemo(() => new Map(context.trained), [context.trained]);
  const queued = useMemo(() => new Map(context.queued), [context.queued]);
  const partialSp = useMemo(() => new Map(context.partialSp), [context.partialSp]);

  const known = useMemo(() => {
    const merged = new Map(trained);
    for (const [skillId, level] of queued) if ((merged.get(skillId) ?? 0) < level) merged.set(skillId, level);
    return merged;
  }, [trained, queued]);

  const startAt = useMemo(() => {
    let start = mountedAt;
    const queueEnd = context.queueEndsAt === null ? null : new Date(context.queueEndsAt);
    if (afterQueue && queueEnd !== null && queueEnd > start) start = queueEnd;
    const free = accountBlock === null ? null : new Date(accountBlock.until);
    if (afterAccount && free !== null && free > start) start = free;
    return start;
  }, [mountedAt, afterQueue, afterAccount, context.queueEndsAt, accountBlock]);

  const attributes = useMemo(
    () => addAttributes(remap ?? context.base, context.implantBonus),
    [remap, context.base, context.implantBonus]);

  const expanded = useMemo(() => expandPlan(entries, known, index), [entries, known, index]);
  const timeline = useMemo(() => planTimeline({
    entries: expanded, catalogue: index, attributes, trained, queued, partialSp, startAt,
  }), [expanded, index, attributes, trained, queued, partialSp, startAt]);
  const view = useMemo(() => planView(timeline, index, entries), [timeline, index, entries]);
  const panel = useMemo(() => attributePanel({
    base: remap ?? context.base, implantBonus: context.implantBonus, effective: attributes,
    bonusRemaps: context.bonusRemaps,
    accruedRemapCooldownDate: context.accruedRemapCooldownDate === null
      ? null : new Date(context.accruedRemapCooldownDate),
    attributesSane: context.attributesSane, timeline, catalogue: index, now: mountedAt,
  }), [remap, context, attributes, timeline, index, mountedAt]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    return catalogue.filter((s) => s.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [query, catalogue]);

  // ── editing ───────────────────────────────────────────────────────────────
  const moveEntry = useCallback((at: number, direction: -1 | 1) => {
    setEntries((prev) => {
      const to = at + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  }, []);
  const removeEntry = useCallback((at: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== at));
  }, []);
  const levelEntry = useCallback((at: number, delta: -1 | 1) => {
    setEntries((prev) => prev.map((e, i) => (i === at
      ? { ...e, level: Math.min(MAX_SKILL_LEVEL, Math.max(1, e.level + delta)) } : e)));
  }, []);
  // Adding a skill already in the plan raises that entry in place; expandPlan would collapse a
  // duplicate anyway, and moving the row would surprise the user.
  const addSkill = useCallback((skillId: number, level: number) => {
    setEntries((prev) => {
      const at = prev.findIndex((e) => e.skillId === skillId);
      if (at >= 0) return prev.map((e, i) => (i === at ? { ...e, level } : e));
      if (prev.length >= MAX_PLAN_ENTRIES) return prev;
      return [...prev, { skillId, level, note: null }];
    });
  }, []);

  // ── saving ────────────────────────────────────────────────────────────────
  const payload = useMemo<SavePayload>(() => ({ name, entries, remap }), [name, entries, remap]);
  const savedRef = useRef(JSON.stringify({ name: plan.name, entries: plan.entries, remap: plan.remap }));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (body: SavePayload) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/skill-plans/${plan.id}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`PUT /api/skill-plans/${plan.id} answered ${res.status}`);
      savedRef.current = JSON.stringify(body);
      setSaveState("saved");
      router.refresh();
    } catch (e) {
      // Spec §7: keep the local state and retry on the next change.
      console.error("[planner] could not save the plan", e);
      setSaveState("error");
    }
    // `router.refresh` rather than `router` itself: Next.js's router object is stable across
    // renders, but under `vi.mock`'s `useRouter: () => ({ push: vi.fn(), refresh })` it is a new
    // object every render. Depending on `router` would give `save` (and the autosave effect below,
    // which depends on `save`) a new identity on every unrelated re-render, tearing down and
    // restarting the 2 s timer before it ever fires.
  }, [plan.id, router.refresh]);

  useEffect(() => {
    // An empty name would 400 on PUT; skip scheduling so a mid-rename clear doesn't wedge autosave
    // in a retry loop. The plan stays dirty — the next keystroke that restores a name re-runs this
    // effect and schedules normally.
    if (payload.name.trim() === "") return;
    if (JSON.stringify(payload) === savedRef.current) return;
    timerRef.current = setTimeout(() => { timerRef.current = null; void save(payload); }, AUTOSAVE_MS);
    return () => { if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [payload, save]);

  const flush = useCallback(async () => {
    if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (JSON.stringify(payload) === savedRef.current) return;
    await save(payload);
  }, [payload, save]);

  // ── remap ─────────────────────────────────────────────────────────────────
  const optimise = useCallback(async () => {
    setOptimising(true);
    try {
      await flush();
      const res = await fetch(`/api/skill-plans/${plan.id}/optimise`, { method: "POST" });
      if (!res.ok) throw new Error(`optimise answered ${res.status}`);
      const result = await res.json() as Parameters<typeof remapSuggestion>[1];
      setSuggested(result.remap);
      setSuggestion(remapSuggestion(context.base, result));
    } catch (e) {
      console.error("[planner] could not optimise the remap", e);
    } finally {
      setOptimising(false);
    }
  }, [flush, plan.id, context.base]);

  const toggleRemap = useCallback((next: boolean) => {
    setRemap(next ? suggested : null);
  }, [suggested]);

  // ── export ────────────────────────────────────────────────────────────────
  const openExport = useCallback(async (format: PlanTextFormat) => {
    setExportFormat(format);
    setExportText("");
    setExportFailed(false);
    try {
      await flush();
      const res = await fetch(`/api/skill-plans/${plan.id}/export?format=${format}`);
      if (!res.ok) throw new Error(`export answered ${res.status}`);
      setExportText(await res.text());
    } catch (e) {
      console.error("[planner] could not export the plan", e);
      setExportText("");
      setExportFailed(true);
    }
  }, [flush, plan.id]);

  return (
    <div className="plan-editor">
      <div className="plan-editor-main">
        <div className="plan-toolbar">
          <input className="fit-name-input" aria-label="Plan name" value={name} maxLength={60}
                 onChange={(e) => setName(e.target.value)} />
          <span className="muted">{characterName}</span>
          <button type="button" className="fit-btn" onClick={() => void flush()}>
            <IconDeviceFloppy size={14} /> Save
          </button>
          <button type="button" className="fit-btn" onClick={() => void openExport(exportFormat)}>
            <IconFileExport size={14} /> Export
          </button>
          <span className={`save-state ${saveState === "error" ? "error" : ""}`}>{SAVE_LABELS[saveState]}</span>
        </div>

        {context.synced ? null : (
          <p className="banner">No skills synced yet for {characterName} — this plan is computed from level 0.</p>
        )}
        {accountBlock === null ? null : (
          <p className="banner">
            {accountBlock.name} is training until {stamp(new Date(accountBlock.until))} — this plan
            can’t start before then.
          </p>
        )}

        <div className="card">
          <div className="stat-row">
            <div><span className="stat-label">Entries</span><span className="stat-value">{view.totals.entries}</span></div>
            <div><span className="stat-label">Remaining</span><span className="stat-value">{view.totals.remaining}</span></div>
            <div><span className="stat-label">SP</span><span className="stat-value">{view.totals.sp}</span></div>
            <div><span className="stat-label">Time</span><span className="stat-value">{view.totals.time}</span></div>
            <div><span className="stat-label">Done</span><span className="stat-value">{view.totals.doneAt}</span></div>
          </div>
          <label className="check-row">
            <input type="checkbox" aria-label="After current queue" checked={afterQueue}
                   onChange={(e) => setAfterQueue(e.target.checked)} />
            After current queue
          </label>
          {accountBlock === null ? null : (
            <label className="check-row">
              <input type="checkbox" aria-label="Start when the account is free" checked={afterAccount}
                     onChange={(e) => setAfterAccount(e.target.checked)} />
              Start when the account is free
            </label>
          )}
          {view.unknownCount === 0 ? null : (
            <p className="faint">{view.unknownCount} entr{view.unknownCount === 1 ? "y" : "ies"} reference a skill this SDE build does not have.</p>
          )}
          <PlanTable rows={view.rows} onMove={moveEntry} onRemove={removeEntry} onLevel={levelEntry} />
        </div>

        <div className="card skill-picker">
          <h2 className="card-title">Add skill</h2>
          {entries.length < MAX_PLAN_ENTRIES ? null : (
            <p className="warn-text">Plan is full — {MAX_PLAN_ENTRIES} entries is the maximum.</p>
          )}
          <input className="filter-input" aria-label="Search skills" value={query} placeholder="Search skills"
                 onChange={(e) => setQuery(e.target.value)} />
          <ul className="skill-picker-results">
            {results.map((skill) => (
              <li key={skill.id} className="skill-picker-row">
                <span>{skill.name}<span className="faint"> · {skill.groupName ?? "—"}</span></span>
                <span className="faint num">×{skill.rank}</span>
                <span className="plan-actions">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button key={level} type="button" className="icon-btn"
                            aria-label={`Add ${skill.name} ${roman(level)}`}
                            onClick={() => addSkill(skill.id, level)}>
                      {roman(level)}
                    </button>
                  ))}
                  <IconPlus size={14} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <AttributesPanel panel={panel} suggestion={suggestion} optimising={optimising}
                       usingRemap={remap !== null} onOptimise={() => void optimise()}
                       onToggleRemap={toggleRemap} />

      {exportText === null ? null : (
        <div className="modal-backdrop" role="dialog" aria-label="Export plan"
             onClick={() => setExportText(null)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">Export plan</h2>
            <div className="plan-toolbar">
              {PLAN_TEXT_FORMATS.map((format) => (
                <button key={format} type="button" className="fit-btn" disabled={format === exportFormat}
                        onClick={() => void openExport(format)}>
                  {format === "evemon" ? "EVEMon (Roman)" : "In-game (Arabic)"}
                </button>
              ))}
              <button type="button" className="fit-btn"
                      onClick={() => void navigator.clipboard?.writeText(exportText)}>Copy</button>
              <button type="button" className="fit-btn" onClick={() => setExportText(null)}>Close</button>
            </div>
            {exportFailed
              ? <p className="warn-text">Could not export — try again.</p>
              : <textarea className="eft-text" aria-label="Plan text" readOnly value={exportText} />}
          </div>
        </div>
      )}
    </div>
  );
}
