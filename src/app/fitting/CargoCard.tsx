"use client";
import { IconTrash } from "@tabler/icons-react";
import type { EditorEntryRow } from "../../lib/fits/editor-view.js";

interface EntryListProps {
  title: string; entries: EditorEntryRow[]; editable: boolean;
  onQuantity: (flag: string, typeId: number, quantity: number) => void;
  onRemoveEntry: (flag: string, typeId: number) => void;
}

function EntryGroup({ title, entries, editable, onQuantity, onRemoveEntry }: EntryListProps) {
  if (entries.length === 0) return null;
  return (
    <div role="group" aria-label={title}>
      <h3 className="slot-title">{title}</h3>
      <ul className="entry-list">
        {entries.map((entry) => (
          <li key={entry.key} className="cargo-row">
            <span data-desc={entry.desc}>{entry.name}</span>
            <span className="cargo-controls">
              {editable ? (
                <input
                  className="qty-input" type="number" min={1} value={entry.quantity}
                  aria-label={`${entry.name} quantity`}
                  onChange={(e) => onQuantity(entry.flag, entry.typeId, Number(e.target.value))}
                />
              ) : <span className="num muted">×{entry.quantity}</span>}
              <span className="num muted">{entry.value ?? "—"}</span>
              {editable ? (
                <button
                  type="button" className="icon-btn danger" aria-label={`Remove ${entry.name}`}
                  onClick={() => onRemoveEntry(entry.flag, entry.typeId)}
                ><IconTrash size={14} /></button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Spec §4's drone bay & cargo hold, now paired with the item browser under `.fit-lower` (part C of
 * the design hand-back) instead of sitting inside the old slots card-stack.
 */
export function CargoCard({
  drones, cargo, unknown, onQuantity, onRemoveEntry,
}: {
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  onQuantity: (flag: string, typeId: number, quantity: number) => void;
  onRemoveEntry: (flag: string, typeId: number) => void;
}) {
  return (
    <div className="card">
      <h2 className="card-title">Drone bay &amp; cargo</h2>
      {drones.length === 0 && cargo.length === 0
        ? <p className="faint">Nothing in the drone bay or the cargo hold.</p>
        : null}
      <EntryGroup title="Drone bay" entries={drones} editable
        onQuantity={onQuantity} onRemoveEntry={onRemoveEntry} />
      <EntryGroup title="Cargo" entries={cargo} editable
        onQuantity={onQuantity} onRemoveEntry={onRemoveEntry} />
      {unknown.length === 0 ? null : (
        <>
          <p className="faint">
            The static data does not know these types, so they are excluded from the calculation.
          </p>
          <EntryGroup title="Unknown types" entries={unknown} editable={false}
            onQuantity={onQuantity} onRemoveEntry={onRemoveEntry} />
        </>
      )}
    </div>
  );
}
