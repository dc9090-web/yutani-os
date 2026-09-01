"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import type { FittingIndex } from "../../lib/fits/load.js";

interface HullOption { id: number; name: string | null }
const SHIP_CATEGORY = 6;
const SEARCH_DEBOUNCE_MS = 250;

export function FitList({ index, characterId }: { index: FittingIndex; characterId: number | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "new" | "import">("none");
  const [hullQuery, setHullQuery] = useState("");
  const [hulls, setHulls] = useState<HullOption[]>([]);
  const [text, setText] = useState("");
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "new" || hullQuery.trim() === "") { setHulls([]); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/sde/types?q=${encodeURIComponent(hullQuery.trim())}&category=${SHIP_CATEGORY}&limit=50`)
        .then((res) => res.json() as Promise<{ types: HullOption[] }>)
        .then((body) => { if (!cancelled) setHulls(body.types); })
        .catch((e: unknown) => { console.error("[fitting] hull search", e); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, hullQuery]);

  async function post(url: string, body: unknown): Promise<{ fit: { id: number }; unresolved?: string[] } | null> {
    setError(null);
    const res = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) { setError("That did not work — nothing was created."); return null; }
    return (await res.json()) as { fit: { id: number }; unresolved?: string[] };
  }

  const createFrom = async (hull: HullOption) => {
    const body = await post("/api/fits", {
      name: hull.name ?? `Type ${hull.id}`, shipTypeId: hull.id, characterId,
    });
    if (body !== null) router.push(`/fitting/${body.fit.id}`);
  };

  const importText = async () => {
    const body = await post("/api/fits/import", { text });
    if (body === null) return;
    if (body.unresolved !== undefined && body.unresolved.length > 0) { setUnresolved(body.unresolved); return; }
    router.push(`/fitting/${body.fit.id}`);
  };

  const cloneFrom = async (url: string, key: string, id: number) => {
    if (characterId === null || id === 0) return;
    const body = await post(url, { characterId, [key]: id });
    if (body !== null) router.push(`/fitting/${body.fit.id}`);
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/fits/${id}`, { method: "DELETE" });
    if (!res.ok) { setError("Could not delete that fit."); return; }
    router.refresh();
  };

  return (
    <>
      <div className="fit-toolbar">
        <button type="button" className="fit-btn" onClick={() => setMode(mode === "new" ? "none" : "new")}>
          <IconPlus size={14} /> New fit
        </button>
        <button type="button" className="fit-btn" onClick={() => setMode(mode === "import" ? "none" : "import")}>
          <IconUpload size={14} /> Import EFT
        </button>
        <select
          className="fit-select" aria-label="From saved fittings" value="0"
          disabled={index.fittings.length === 0}
          onChange={(e) => { void cloneFrom("/api/fits/from-fitting", "fittingId", Number(e.target.value)); }}
        >
          <option value="0">From saved fittings…</option>
          {index.fittings.map((f) => <option key={f.id} value={String(f.id)}>{f.label}</option>)}
        </select>
        <select
          className="fit-select" aria-label="From my ships" value="0"
          disabled={index.ships.length === 0}
          onChange={(e) => { void cloneFrom("/api/fits/from-asset", "itemId", Number(e.target.value)); }}
        >
          <option value="0">From my ships…</option>
          {index.ships.map((s) => <option key={s.id} value={String(s.id)}>{s.label}</option>)}
        </select>
      </div>

      {error === null ? null : <p className="card banner">{error}</p>}

      {mode === "new" ? (
        <div className="card">
          <h2 className="card-title">Pick a hull</h2>
          <label className="faint" htmlFor="hull-search">Search hulls</label>
          <input
            id="hull-search" className="filter-input" type="search" value={hullQuery}
            aria-label="Search hulls" placeholder="Rifter, Vexor, Tengu, …"
            onChange={(e) => setHullQuery(e.target.value)}
          />
          <ul className="browser-results">
            {hulls.map((hull) => (
              <li key={hull.id} className="browser-row">
                <span /><span>{hull.name}</span><span />
                <button
                  type="button" className="icon-btn" aria-label={`New ${hull.name} fit`}
                  onClick={() => { void createFrom(hull); }}
                ><IconPlus size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mode === "import" ? (
        <div className="card">
          <h2 className="card-title">Import EFT</h2>
          <textarea
            className="eft-text" aria-label="EFT text" value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="fit-toolbar">
            <button type="button" className="fit-btn" onClick={() => { void importText(); }}>Import</button>
          </div>
          {unresolved.length === 0 ? null : (
            <p className="faint">
              Imported, but these lines could not be resolved: {unresolved.join(", ")}
            </p>
          )}
        </div>
      ) : null}

      {index.rows.length === 0 ? <p className="faint">No fits yet — start one with “New fit”.</p> : (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Ship</th><th>Pilot</th><th>Updated</th><th className="num">Value</th><th /></tr>
            </thead>
            <tbody>
              {index.rows.map((row) => (
                <tr key={row.id}>
                  <td><Link href={`/fitting/${row.id}`}>{row.name}</Link></td>
                  <td>{row.typeName}</td>
                  <td className="muted">{row.pilot}</td>
                  <td className="muted">{row.updated}</td>
                  <td className="num">
                    {row.value}
                    {row.unpriced === null ? null : <span className="faint"> · {row.unpriced}</span>}
                  </td>
                  <td>
                    <button
                      type="button" className="icon-btn danger" aria-label={`Delete ${row.name}`}
                      onClick={() => { void remove(row.id); }}
                    ><IconTrash size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
