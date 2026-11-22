"use client";
import { useMemo, useState } from "react";
import { Chevron } from "../components/Disclosure.js";
import {
  contentsEmpty, filterContents, locationContents,
  type AssetContents, type AssetGroupView, type AssetItemRow, type AssetViewLocation,
} from "../../lib/view/assets.js";
import { grouped } from "../../lib/view/format.js";

/** "27,294 m³" / "1.2 m³" — whole numbers grouped, small volumes to one decimal. */
function volume(m3: number): string {
  return `${m3 >= 10 ? grouped(Math.round(m3)) : String(Math.round(m3 * 10) / 10)} m³`;
}

function ItemRow({ row, description }: { row: AssetItemRow; description: string | undefined }) {
  return (
    <li className="as-item">
      {/* A type the image server has no picture for keeps its tile, so the names stay aligned. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="yo-tile as-icon" src={row.iconUrl} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("is-blank")} />
      <span className="as-qty">{row.quantity > 1 ? `${grouped(row.quantity)}×` : ""}</span>
      <span className="as-item-text">
        <span className="as-item-name">
          <span data-desc={description}>{row.typeName}</span>
          {row.name === null ? null : <span className="as-item-nick"> {row.name}</span>}
          {row.isBlueprintCopy ? <span className="yo-tag as-bpc">BPC</span> : null}
        </span>
        {row.note === null ? null : <span className="as-item-note">{row.note}</span>}
      </span>
      {row.where === null ? null : <span className="as-where">{row.where}</span>}
    </li>
  );
}

function Groups({ groups, descriptions }: { groups: AssetGroupView[]; descriptions: Record<number, string> }) {
  return (
    <div className="as-groups">
      {groups.map((group) => (
        <div key={group.name} className="as-group">
          <div className="as-group-head">
            <h3 className="as-group-title">{group.name}</h3>
            <span className="as-group-count">{group.count}</span>
          </div>
          <ul className="as-items">
            {group.items.map((row) => <ItemRow key={row.key} row={row} description={descriptions[row.typeId]} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Contents({ contents, descriptions }: { contents: AssetContents; descriptions: Record<number, string> }) {
  return (
    <div className="as-body">
      {contents.holders.map((holder) => (
        <div key={holder.itemId} className="as-holder">
          <div className="as-holder-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="yo-tile as-holder-icon" src={holder.iconUrl} alt="" loading="lazy" onError={(e) => e.currentTarget.classList.add("is-blank")} />
            <div className="as-holder-id">
              <span className="as-holder-title">
                <span data-desc={descriptions[holder.typeId]}>{holder.title}</span>
                {holder.label === null ? null : <span className="as-holder-label"> {holder.label}</span>}
              </span>
              <span className="as-holder-summary">{holder.summary}</span>
            </div>
            <span className="as-holder-flag">{holder.flag}</span>
          </div>
          <Groups groups={holder.groups} descriptions={descriptions} />
        </div>
      ))}
      {contents.loose.length === 0 ? null : <Groups groups={contents.loose} descriptions={descriptions} />}
    </div>
  );
}

/**
 * The Assets locations list (redesign hand-off, `Assets.dc.html`): one collapsible row per station,
 * most items first. An open location shows each ship or container as a header with its contents in
 * columns. The filter narrows by location name and by item name; a location with a matching item
 * opens by itself, showing only the matches.
 */
export function AssetsBrowser({ locations, descriptions = {} }: { locations: AssetViewLocation[]; descriptions?: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const [openLocations, setOpenLocations] = useState<number[]>([]);
  const needle = query.trim().toLowerCase();

  // Grouping a 1,300-item hangar is not free: do it once per location, and only filter on typing.
  const grouped_ = useMemo(() => new Map(locations.map((l) => [l.locationId, locationContents(l.nodes)])), [locations]);
  const shown = useMemo(() => locations.flatMap((location) => {
    const all = grouped_.get(location.locationId)!;
    if (needle === "") return [{ location, contents: all, itemHit: false }];
    if (location.label.toLowerCase().includes(needle)) return [{ location, contents: all, itemHit: false }];
    const contents = filterContents(all, needle);
    return contentsEmpty(contents) ? [] : [{ location, contents, itemHit: true }];
  }), [locations, grouped_, needle]);

  const toggleLocation = (id: number) =>
    setOpenLocations((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (<>
    <div className="as-filter">
      <label className="yo-label" htmlFor="asset-filter">Filter by name</label>
      <input id="asset-filter" className="yo-input" type="search" value={query}
        placeholder="Gyrostabilizer, Tritanium…" onChange={(e) => setQuery(e.target.value)} />
    </div>
    <section className="as-locations" aria-label="Locations">
      {locations.length === 0 ? <p className="yo-empty">Not synced yet — the assets job runs hourly.</p> : (<>
        {shown.length === 0 ? null : (
          <div className="as-list">
            <div className="as-list-head yo-label">
              <span className="as-chev-space" />
              <span className="as-loc-name">Location</span>
              <span className="as-loc-items is-sorted">Items ↓</span>
              <span className="as-loc-volume">Volume</span>
            </div>
            {shown.map(({ location, contents, itemHit }) => {
              // A location with a matching item is held open — hiding a match would be useless.
              const open = itemHit || openLocations.includes(location.locationId);
              return (
                <div key={location.locationId} className="as-loc" data-open={open || undefined}>
                  <button type="button" className="as-loc-row" aria-expanded={open} onClick={() => toggleLocation(location.locationId)}>
                    <Chevron open={open} />
                    <span className="as-loc-name">{location.label}</span>
                    <span className="as-loc-items">{grouped(location.itemCount)}<span className="as-loc-unit"> item{location.itemCount === 1 ? "" : "s"}</span></span>
                    <span className="as-loc-volume">{volume(location.volume)}</span>
                  </button>
                  {open ? <Contents contents={contents} descriptions={descriptions} /> : null}
                </div>
              );
            })}
          </div>
        )}
        {shown.length === 0 ? <p className="as-none">No locations or items match that filter.</p> : null}
        <span className="as-foot">
          {needle === ""
            ? `All ${locations.length} location${locations.length === 1 ? "" : "s"}, most items first`
            : `${shown.length} of ${locations.length} location${locations.length === 1 ? "" : "s"} match`}
        </span>
      </>)}
    </section>
  </>);
}
