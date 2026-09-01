"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCopy, IconFileExport, IconTrash } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import {
  dogmaData, ensureTypes, getDogmaMeta, pricesFor, skillContext, type SkillContext,
} from "../../lib/fits/client-data.js";
import type { FitDoc, FitItem, FitItemState } from "../../lib/fits/doc.js";
import { computeEditor, fitTypeIds } from "../../lib/fits/editor-view.js";
import { exportEft } from "../../lib/fits/eft.js";
import {
  fitTypeInto, removeSlot, setEntryQuantity, setSlotCharge, setSlotState,
} from "../../lib/fits/slots.js";
import type { BonusView } from "../../lib/view/fit-sheet.js";
import type { Price } from "../../lib/view/price.js";
import { ItemBrowser } from "./ItemBrowser.js";
import { SlotLayout } from "./SlotLayout.js";
import { StatsPanel } from "./StatsPanel.js";

/** Spec §4: "autosaves 2 s after the last change with a 'saved' indicator". */
export const AUTOSAVE_MS = 2000;

export interface FitEditorProps {
  fit: {
    id: number; name: string; description: string; shipTypeId: number;
    characterId: number | null; items: FitItem[];
  };
  characters: { id: number; name: string }[];
  bonuses: BonusView[];
}

interface SavePayload {
  name: string; description: string; characterId: number | null; items: FitItem[];
}

function toPayload(doc: FitDoc): SavePayload {
  return {
    name: doc.name, description: doc.description,
    characterId: doc.characterId === "all-v" ? null : doc.characterId,
    items: doc.items,
  };
}

const SAVE_LABELS = { idle: "", saving: "Saving…", saved: "Saved", error: "Could not save — retrying on the next change" };

export function FitEditor({ fit, characters, bonuses }: FitEditorProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<FitDoc>(() => ({
    id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
    characterId: fit.characterId ?? "all-v", items: fit.items,
  }));
  const [context, setContext] = useState<SkillContext | null>(null);
  const [prices, setPrices] = useState<ReadonlyMap<number, Price>>(new Map());
  const [loads, setLoads] = useState(0);
  const [dataError, setDataError] = useState(false);
  const [selected, setSelected] = useState<{ slot: SlotKind; index: number } | null>(null);
  const [saveState, setSaveState] = useState<keyof typeof SAVE_LABELS>("idle");
  const [showExport, setShowExport] = useState(false);
  // Lazily initialised, once: a plain `useRef(JSON.stringify(toPayload(...)))` would rebuild the
  // payload and re-stringify it on every render just to throw the result away.
  const savedRef = useRef<string | null>(null);
  if (savedRef.current === null) {
    savedRef.current = JSON.stringify(toPayload({
      id: fit.id, name: fit.name, description: fit.description, shipTypeId: fit.shipTypeId,
      characterId: fit.characterId ?? "all-v", items: fit.items,
    }));
  }

  // The ids the document references, as a stable dependency.
  const typeKey = useMemo(() => fitTypeIds(doc).join(","), [doc]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await getDogmaMeta();
      await ensureTypes(typeKey.split(",").map(Number));
      if (!cancelled) setLoads((n) => n + 1);
    })().catch((e: unknown) => {
      console.error("[fitting] could not load the static data", e);
      if (!cancelled) setDataError(true);
    });
    return () => { cancelled = true; };
  }, [typeKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await getDogmaMeta();
      const loaded = await skillContext(doc.characterId);
      if (!cancelled) { setContext(loaded); setLoads((n) => n + 1); }
    })().catch((e: unknown) => {
      console.error("[fitting] could not load the skill context", e);
      if (!cancelled) setDataError(true);
    });
    return () => { cancelled = true; };
  }, [doc.characterId]);

  useEffect(() => {
    let cancelled = false;
    pricesFor(typeKey.split(",").map(Number))
      .then((loaded) => { if (!cancelled) setPrices(loaded); })
      .catch((e: unknown) => { console.error("[fitting] could not load prices", e); });
    return () => { cancelled = true; };
  }, [typeKey]);

  const save = useCallback(async (payload: SavePayload) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/fits/${fit.id}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PUT /api/fits/${fit.id} answered ${res.status}`);
      savedRef.current = JSON.stringify(payload);
      setSaveState("saved");
    } catch (e) {
      // Spec §7: the local state is kept and the next change retries.
      console.error("[fitting] could not save the fit", e);
      setSaveState("error");
    }
  }, [fit.id]);

  useEffect(() => {
    const payload = toPayload(doc);
    if (JSON.stringify(payload) === savedRef.current) return;
    const timer = setTimeout(() => { void save(payload); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [doc, save]);

  const result = useMemo(() => {
    if (context === null || loads === 0) return null;
    return computeEditor(
      doc, { data: dogmaData(), skills: context.skills, implants: context.implants }, prices);
  }, [doc, context, prices, loads]);

  const totals = result !== null && result.kind === "ok" ? result.totals : null;

  const fitType = useCallback((typeId: number) => {
    if (totals === null) return;
    setDoc((current) => fitTypeInto(current, dogmaData(), typeId, totals, selected ?? undefined));
  }, [totals, selected]);

  const loadCharge = useCallback((typeId: number) => {
    if (selected === null) return;
    setDoc((current) => setSlotCharge(current, selected.slot, selected.index, typeId));
  }, [selected]);

  const clone = async () => {
    const res = await fetch("/api/fits", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...toPayload(doc), name: `${doc.name} copy`, shipTypeId: doc.shipTypeId }),
    });
    if (!res.ok) { setSaveState("error"); return; }
    const body = (await res.json()) as { fit: { id: number } };
    router.push(`/fitting/${body.fit.id}`);
  };

  const remove = async () => {
    const res = await fetch(`/api/fits/${fit.id}`, { method: "DELETE" });
    if (!res.ok) { setSaveState("error"); return; }
    router.push("/fitting");
    router.refresh();
  };

  if (dataError) {
    return (<>
      <h1 className="page-title">{doc.name}</h1>
      <div className="card coming-soon">Could not load the static data — the error was logged.</div>
    </>);
  }
  if (result === null) {
    return (<>
      <h1 className="page-title">{doc.name}</h1>
      <div className="card coming-soon">Loading the static data…</div>
    </>);
  }
  if (result.kind === "error") {
    return (<>
      <h1 className="page-title">{doc.name}</h1>
      <div className="card coming-soon">Could not compute this fit — the error was logged.</div>
    </>);
  }

  const selectedTypeId = result.view.blocks
    .find((b) => b.slot === selected?.slot)?.rows
    .find((r) => r.index === selected?.index)?.typeId ?? null;

  return (
    <>
      <div className="fit-toolbar">
        <input
          className="fit-name-input" value={doc.name} aria-label="Fit name"
          onChange={(e) => setDoc((current) => ({ ...current, name: e.target.value }))}
        />
        <label className="faint" htmlFor="fit-pilot">Pilot</label>
        <select
          id="fit-pilot" className="fit-select" aria-label="Pilot"
          value={doc.characterId === "all-v" ? "all-v" : String(doc.characterId)}
          onChange={(e) => setDoc((current) => ({
            ...current,
            characterId: e.target.value === "all-v" ? "all-v" : Number(e.target.value),
          }))}
        >
          <option value="all-v">All skills V</option>
          {characters.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <button type="button" className="fit-btn" onClick={() => setShowExport(true)}>
          <IconFileExport size={14} /> Export EFT
        </button>
        <button type="button" className="fit-btn" onClick={() => { void clone(); }}>
          <IconCopy size={14} /> Clone
        </button>
        <button type="button" className="fit-btn danger" onClick={() => { void remove(); }}>
          <IconTrash size={14} /> Delete
        </button>
        <span className={`save-state${saveState === "error" ? " error" : ""}`}>{SAVE_LABELS[saveState]}</span>
      </div>

      <div className="fit-editor">
        <div className="fit-editor-main">
          <SlotLayout
            blocks={result.view.blocks}
            drones={result.view.drones} cargo={result.view.cargo} unknown={result.view.unknown}
            selected={selected}
            onSelect={(slot, index) => setSelected({ slot, index })}
            onRemove={(slot, index) => setDoc((c) => removeSlot(c, slot, index))}
            onState={(slot, index, state: FitItemState) => setDoc((c) => setSlotState(c, slot, index, state))}
            onClearCharge={(slot, index) => setDoc((c) => setSlotCharge(c, slot, index, null))}
            onQuantity={(flag, typeId, quantity) => setDoc((c) => setEntryQuantity(c, flag, typeId, quantity))}
            onRemoveEntry={(flag, typeId) => setDoc((c) => setEntryQuantity(c, flag, typeId, 0))}
          />
          <ItemBrowser
            shipTypeId={doc.shipTypeId}
            selected={selected === null || selectedTypeId === null
              ? null
              : { slot: selected.slot, index: selected.index, typeId: selectedTypeId }}
            onFit={fitType}
            onCharge={loadCharge}
          />
        </div>
        <StatsPanel view={result.view} bonuses={bonuses} skillsSynced={context?.synced ?? false} />
      </div>

      {showExport ? (
        <div className="modal-backdrop" role="dialog" aria-label="Export EFT">
          <div className="card modal">
            <h2 className="card-title">Export EFT</h2>
            <textarea
              className="eft-text" aria-label="EFT text" readOnly
              value={exportEft(doc, dogmaData(), result.totals)}
            />
            <div className="fit-toolbar">
              <button
                type="button" className="fit-btn"
                onClick={() => {
                  void navigator.clipboard?.writeText(exportEft(doc, dogmaData(), result.totals));
                }}
              >Copy</button>
              <button type="button" className="fit-btn" onClick={() => setShowExport(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
