"use client";
import { useEffect, useMemo, useState } from "react";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import { dogmaData, ensureTypes } from "../../lib/fits/client-data.js";
import { canFitShip, chargeFits, CHARGE_GROUP_ATTRS } from "../../lib/fits/slots.js";
import { typeDesc, typeIconUrl } from "../../lib/fits/editor-view.js";

export interface BrowseType {
  id: number; name: string | null; groupId: number | null; categoryId: number | null;
  marketGroupId: number | null; metaGroup: string | null; metaLevel: number | null;
}
interface MarketGroup { id: number; parentId: number | null; name: string | null; hasTypes: boolean | null }

/** Spec §4: modules, charges, drones and subsystems. */
export const FIT_CATEGORIES: readonly number[] = [7, 8, 18, 32];
const CHARGE_CATEGORY = 8;
const SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 50;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return (await res.json()) as T;
}

export function ItemBrowser({ shipTypeId, selected, onFit, onCharge }: {
  shipTypeId: number;
  selected: { slot: SlotKind; index: number; typeId: number } | null;
  onFit: (typeId: number) => void;
  onCharge: (typeId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyFitting, setOnlyFitting] = useState(true);
  const [groups, setGroups] = useState<MarketGroup[]>([]);
  const [path, setPath] = useState<MarketGroup[]>([]);
  const [results, setResults] = useState<BrowseType[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Charge mode is derived from the selection — spec §4 puts the charge list in this panel.
  const chargeMode = useMemo(() => {
    if (selected === null) return null;
    const type = dogmaData().types.get(selected.typeId);
    return type !== undefined && hasChargeGroups(type) ? type : null;
  }, [selected]);

  useEffect(() => {
    getJson<{ groups: MarketGroup[] }>("/api/sde/market-groups")
      .then((body) => setGroups(body.groups))
      .catch((e: unknown) => { console.error("[fitting] market groups", e); });
  }, []);

  const marketGroupId = path.length === 0 ? null : path[path.length - 1].id;

  useEffect(() => {
    const trimmed = query.trim();
    if (chargeMode === null && trimmed === "" && marketGroupId === null) { setResults([]); return; }

    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed !== "") params.set("q", trimmed);
      params.set("category", chargeMode === null ? FIT_CATEGORIES.join(",") : String(CHARGE_CATEGORY));
      if (chargeMode === null && marketGroupId !== null) params.set("marketGroup", String(marketGroupId));
      params.set("limit", String(RESULT_LIMIT));

      getJson<{ types: BrowseType[] }>(`/api/sde/types?${params.toString()}`)
        .then(async (body) => {
          // The engine needs these types to answer "does this fit" and "what does it cost to fit".
          await ensureTypes(body.types.map((t) => t.id));
          if (!cancelled) { setResults(body.types); setError(null); }
        })
        .catch((e: unknown) => {
          console.error("[fitting] search", e);
          if (!cancelled) setError("Could not search the static data.");
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, marketGroupId, chargeMode]);

  const data = dogmaData();
  const ship = data.types.get(shipTypeId);
  const shown = results.filter((row) => {
    const type = data.types.get(row.id);
    if (type === undefined) return true;                      // not loaded yet: show it, do not lie
    if (chargeMode !== null) return chargeFits(chargeMode, type);
    if (!onlyFitting || ship === undefined) return true;
    return canFitShip(ship, type);
  });

  const children = groups.filter((g) => g.parentId === marketGroupId);

  return (
    <div className="card">
      <h2 className="card-title">{chargeMode === null ? "Add items" : `Charges for ${chargeMode.name}`}</h2>

      <input
        id="item-search" className="filter-input" type="search" value={query}
        placeholder="Search: Gyrostabilizer, Hail S, Warrior II, …"
        aria-label="Search items"
        onChange={(e) => setQuery(e.target.value)}
      />

      {chargeMode === null ? (
        <>
          <label className="check-row">
            <input type="checkbox" checked={onlyFitting}
              onChange={(e) => setOnlyFitting(e.target.checked)} />
            Fits this hull
          </label>
          <div className="browser-crumbs">
            <button type="button" className="crumb" onClick={() => setPath([])}>Market</button>
            {path.map((group, index) => (
              <span key={group.id}>
                <IconChevronRight size={11} />
                <button type="button" className="crumb" onClick={() => setPath(path.slice(0, index + 1))}>
                  {group.name}
                </button>
              </span>
            ))}
          </div>
          <ul className="browser-results">
            {children.map((group) => (
              <li key={group.id} className="browser-row">
                <IconChevronRight size={12} />
                <button type="button" className="crumb" onClick={() => setPath([...path, group])}>
                  {group.name}
                </button>
                <span /><span />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {error === null ? null : <p className="faint">{error}</p>}

      <ul className="browser-results">
        {shown.map((row) => (
          <li key={row.id} className="browser-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="module-icon" src={typeIconUrl(row.id)} alt="" />
            <span data-desc={typeDesc(data, row.id)}>{row.name}</span>
            {row.metaGroup === null ? <span /> : <span className="badge meta">{row.metaGroup}</span>}
            <button
              type="button" className="icon-btn"
              aria-label={`${chargeMode === null ? "Fit" : "Load"} ${row.name}`}
              onClick={() => (chargeMode === null ? onFit(row.id) : onCharge(row.id))}
            ><IconPlus size={14} /></button>
          </li>
        ))}
      </ul>
      {shown.length === 0 && query.trim() !== ""
        ? <p className="faint">Nothing matches “{query.trim()}”.</p> : null}
    </div>
  );
}

/** A module with no `chargeGroup*` takes no charge, so selecting it must not switch modes. */
function hasChargeGroups(type: { attrs: Map<number, number> }): boolean {
  return CHARGE_GROUP_ATTRS.some((attrId) => type.attrs.get(attrId) !== undefined);
}
