"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IconArrowDown, IconArrowUp, IconCheck, IconX } from "@tabler/icons-react";
import { portraitUrl } from "../../lib/view/characters.js";

interface Row { id: number; name: string; shown: boolean }

/** Shown characters in their current order, then everyone else in the stored character order. */
function initialRows(all: { id: number; name: string }[], selected: number[]): Row[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const shown = selected.flatMap((id) => {
    const c = byId.get(id);
    return c ? [{ ...c, shown: true }] : [];
  });
  const picked = new Set(selected);
  return [...shown, ...all.filter((c) => !picked.has(c.id)).map((c) => ({ ...c, shown: false }))];
}

/**
 * Edit mode for the Skills page's Overview tab: an Edit button beside the legend that swaps the grid for a list of
 * every character with a show/hide checkbox and up/down arrows. Save writes the shown ones, in list
 * order, to `PUT /api/multiview` and refreshes the page so the server re-renders the grid.
 */
export function MultiviewEditor({ all, selected, legend, children }: {
  all: { id: number; name: string }[];
  selected: number[];
  /** The block legend the Edit button shares a row with. */
  legend?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => initialRows(all, selected));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = () => { setRows(initialRows(all, selected)); setFailed(false); setEditing(true); };
  const toggle = (id: number) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, shown: !r.shown } : r)));
  const move = (index: number, by: -1 | 1) => setRows((rs) => {
    const next = [...rs];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return next;
  });

  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const characterIds = rows.filter((r) => r.shown).map((r) => r.id);
      const res = await fetch("/api/multiview", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ characterIds }),
      });
      if (!res.ok) throw new Error(`PUT /api/multiview answered ${res.status}`);
      setEditing(false);
      router.refresh();
    } catch (e) {
      console.error("[multiview] could not save", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <>
        <div className="tq-toolbar">
          {legend}
          <button type="button" className="yo-btn tq-edit" onClick={start}>
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2.5l2 2L5 11l-2.6.6L3 9z" /></svg>
            Edit
          </button>
        </div>
        {children}
      </>
    );
  }

  const shownCount = rows.filter((r) => r.shown).length;
  return (
    <>
      <div className="tq-toolbar">
        <button type="button" className="yo-btn" disabled={busy || shownCount === 0} onClick={() => void save()}>
          <IconCheck size={14} /> Save
        </button>
        <button type="button" className="yo-btn" disabled={busy} onClick={() => setEditing(false)}>
          <IconX size={14} /> Cancel
        </button>
        {shownCount === 0 ? <span className="yo-muted">Pick at least one character</span> : null}
        {failed ? <span className="yo-bad">Could not save — try again</span> : null}
      </div>
      <ol className="mv-edit">
        {rows.map((row, index) => (
          <li key={row.id} className="mv-row" data-hidden={!row.shown || undefined}>
            <label className="mv-pick">
              <input type="checkbox" checked={row.shown} onChange={() => toggle(row.id)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portraitUrl(row.id)} alt="" className="yo-tile mv-portrait" />
              <span className="mv-name">{row.name}</span>
            </label>
            <button type="button" className="yo-btn mv-move" aria-label={`Move ${row.name} up`}
                    disabled={index === 0} onClick={() => move(index, -1)}>
              <IconArrowUp size={14} />
            </button>
            <button type="button" className="yo-btn mv-move" aria-label={`Move ${row.name} down`}
                    disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
              <IconArrowDown size={14} />
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
