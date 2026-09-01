"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconFileImport, IconPlus, IconTemplate, IconTrash } from "@tabler/icons-react";
import { clampPlanName } from "../../lib/skills/parse.js";

export interface PlanListRow {
  id: number; name: string; entries: number; remaining: string; doneAt: string;
}
export interface PlansCardProps {
  characterId: number;
  plans: PlanListRow[];
  templates: { id: number; name: string }[];
}

type Panel = "none" | "new" | "template" | "import";

export function PlansCard({ characterId, plans, templates }: PlansCardProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>("none");
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [created, setCreated] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const create = useCallback(async (url: string, body: unknown) => {
    setBusy(true); setFailed(false); setUnresolved([]); setCreated(null);
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${url} answered ${res.status}`);
      const json = await res.json() as { plan: { id: number }; unresolved?: string[] };
      // Spec §7: unresolved lines are reported, not fatal. The plan exists either way; we only hold
      // the navigation back so the user can read what was dropped before leaving the page.
      if (json.unresolved !== undefined && json.unresolved.length > 0) {
        setUnresolved(json.unresolved);
        setCreated(json.plan.id);
      } else {
        router.push(`/skills/plans/${json.plan.id}`);
      }
    } catch (e) {
      console.error("[planner] could not create the plan", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [router]);

  const remove = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/skill-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`DELETE /api/skill-plans/${id} answered ${res.status}`);
      router.refresh();
    } catch (e) {
      console.error("[planner] could not delete the plan", e);
      setFailed(true);
    }
  }, [router]);

  return (
    <div className="card">
      <h2 className="card-title">Plans</h2>
      <div className="plan-toolbar">
        <button type="button" className="fit-btn" onClick={() => setPanel(panel === "new" ? "none" : "new")}>
          <IconPlus size={14} /> New plan
        </button>
        <button type="button" className="fit-btn" disabled={templates.length === 0}
                onClick={() => setPanel(panel === "template" ? "none" : "template")}>
          <IconTemplate size={14} /> From template
        </button>
        <button type="button" className="fit-btn" onClick={() => setPanel(panel === "import" ? "none" : "import")}>
          <IconFileImport size={14} /> Import
        </button>
      </div>

      {panel === "none" ? null : (
        <div className="skill-picker">
          {panel === "template" ? (
            <select className="fit-select" aria-label="Template" value={templateId}
                    onChange={(e) => setTemplateId(Number(e.target.value))}>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          ) : (
            <input className="filter-input" aria-label="Plan name" value={name} placeholder="Plan name"
                   maxLength={60} onChange={(e) => setName(e.target.value)} />
          )}
          {panel === "import" ? (
            <textarea className="eft-text" aria-label="Plan text" value={text} placeholder="Gunnery V"
                      onChange={(e) => setText(e.target.value)} />
          ) : null}
          {panel === "new" ? (
            <button type="button" className="fit-btn" disabled={busy || name.trim() === ""}
                    onClick={() => void create("/api/skill-plans", { characterId, name: name.trim() })}>
              Create
            </button>
          ) : null}
          {panel === "template" ? (
            <button type="button" className="fit-btn" disabled={busy}
                    onClick={() => void create("/api/skill-plans", {
                      characterId,
                      name: clampPlanName(templates.find((t) => t.id === templateId)?.name ?? "Career plan"),
                      templateId,
                    })}>
              Create from template
            </button>
          ) : null}
          {panel === "import" ? (
            <button type="button" className="fit-btn" disabled={busy || name.trim() === "" || text.trim() === ""}
                    onClick={() => void create("/api/skill-plans/import", { characterId, name: name.trim(), text })}>
              Import plan
            </button>
          ) : null}
          {unresolved.length === 0 ? null : (
            <>
              <p className="warn-text">These lines did not resolve to a skill:</p>
              {/* Keyed by index+line: a duplicate bad line (e.g. the same typo pasted twice) would
                  otherwise collide on `key={line}`. */}
              <ul className="problem-list">
                {unresolved.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
              </ul>
              {created === null ? null : (
                <button type="button" className="fit-btn"
                        onClick={() => router.push(`/skills/plans/${created}`)}>
                  Open plan
                </button>
              )}
            </>
          )}
          {failed ? <p className="warn-text">Could not reach the server — try again.</p> : null}
        </div>
      )}

      {plans.length === 0 ? <p className="faint">No plans yet — start one with “New plan”.</p> : (
        <ul className="entry-list">
          {plans.map((plan) => (
            <li key={plan.id} className="plan-list-row">
              <Link href={`/skills/plans/${plan.id}`}>{plan.name}</Link>
              <span className="muted num">{plan.entries}</span>
              <span className="num">{plan.remaining}</span>
              <span className="muted">{plan.doneAt}</span>
              <button type="button" className="icon-btn danger" aria-label={`Delete ${plan.name}`}
                      onClick={() => void remove(plan.id)}>
                <IconTrash size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
