"use client";
import { useMemo, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { filterAssetTree, type AssetViewLocation, type AssetViewNode } from "../../lib/view/assets.js";
import { grouped } from "../../lib/view/format.js";

/** "27,294 m³" / "1.2 m³" — whole numbers grouped, small volumes to one decimal. */
function volume(m3: number): string {
  return `${m3 >= 10 ? grouped(Math.round(m3)) : String(Math.round(m3 * 10) / 10)} m³`;
}

function ItemRow({ node, depth, collapsed, onToggle }: {
  node: AssetViewNode; depth: number; collapsed: Set<number>; onToggle: (itemId: number) => void;
}) {
  const open = !collapsed.has(node.itemId);
  return (<>
    <li className="tree-row" style={{ paddingLeft: depth * 18 }}>
      {node.children.length === 0
        ? <span className="tree-toggle" aria-hidden="true" />
        : (
          <button type="button" className="tree-toggle" aria-label={`${open ? "collapse" : "expand"} ${node.typeName}`} onClick={() => onToggle(node.itemId)}>
            {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </button>
        )}
      <span>{node.typeName}</span>
      {node.name === null ? null : <span className="muted">{node.name}</span>}
      {node.isBlueprintCopy ? <span className="badge bpc">BPC</span> : null}
      {node.quantity > 1 ? <span className="muted">×{grouped(node.quantity)}</span> : null}
      <span className="tree-flag">{node.flag}</span>
    </li>
    {open ? node.children.map((child) => (
      <ItemRow key={child.itemId} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
    )) : null}
  </>);
}

export function AssetsBrowser({ locations }: { locations: AssetViewLocation[] }) {
  const [query, setQuery] = useState("");
  const [openLocations, setOpenLocations] = useState<number[]>([]);
  // Items default to expanded so a docked ship shows its fitted modules; this is the opt-out set.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const filtering = query.trim() !== "";
  const shown = useMemo(() => {
    if (!filtering) return locations;
    return locations
      .map((location) => ({ ...location, nodes: filterAssetTree(location.nodes, query) }))
      .filter((location) => location.nodes.length > 0);
  }, [locations, query, filtering]);

  if (locations.length === 0) return <p className="faint">Not synced yet — the assets job runs hourly.</p>;

  const toggleLocation = (id: number) =>
    setOpenLocations((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const toggleItem = (itemId: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });

  return (
    <div>
      <label className="faint" htmlFor="asset-filter">Filter by name</label>
      <input id="asset-filter" className="filter-input" type="search" value={query}
        placeholder="Gyrostabilizer, Tritanium, …" onChange={(e) => setQuery(e.target.value)} />
      {shown.length === 0 ? <p className="faint">Nothing matches “{query.trim()}”.</p> : null}
      {shown.map((location) => {
        // While filtering every surviving location is open — hiding a match would be useless.
        const open = filtering || openLocations.includes(location.locationId);
        return (
          <div key={location.locationId}>
            <button type="button" className="loc-toggle" aria-expanded={open} onClick={() => toggleLocation(location.locationId)}>
              {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <span>{location.label}</span>
              <span className="loc-meta">
                {location.itemCount} item{location.itemCount === 1 ? "" : "s"} · {volume(location.volume)}
              </span>
            </button>
            {open ? (
              <ul className="tree">
                {location.nodes.map((node) => (
                  <ItemRow key={node.itemId} node={node} depth={0} collapsed={collapsed} onToggle={toggleItem} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
