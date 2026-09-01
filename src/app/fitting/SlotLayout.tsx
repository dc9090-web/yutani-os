"use client";
import { IconTrash, IconX } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import type { FitItemState } from "../../lib/fits/doc.js";
import { STATE_LABELS, type EditorEntryRow, type EditorSlotBlock } from "../../lib/fits/editor-view.js";
import { AffectedBy } from "../ships/AffectedBy.js";

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
          <li key={entry.key}>
            <span>{entry.name}</span>
            <span>
              {editable ? (
                <input
                  className="qty-input" type="number" min={1} value={entry.quantity}
                  aria-label={`${entry.name} quantity`}
                  onChange={(e) => onQuantity(entry.flag, entry.typeId, Number(e.target.value))}
                />
              ) : <span className="num muted">×{entry.quantity}</span>}
              <span className="num muted"> {entry.value ?? "—"}</span>
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

/** Spec §4's left column: one row per slot the hull has, plus the drone bay and the cargo hold. */
export function SlotLayout({
  blocks, drones, cargo, unknown, selected,
  onSelect, onRemove, onState, onClearCharge, onQuantity, onRemoveEntry,
}: {
  blocks: EditorSlotBlock[];
  drones: EditorEntryRow[]; cargo: EditorEntryRow[]; unknown: EditorEntryRow[];
  selected: { slot: SlotKind; index: number } | null;
  onSelect: (slot: SlotKind, index: number) => void;
  onRemove: (slot: SlotKind, index: number) => void;
  onState: (slot: SlotKind, index: number, state: FitItemState) => void;
  onClearCharge: (slot: SlotKind, index: number) => void;
  onQuantity: (flag: string, typeId: number, quantity: number) => void;
  onRemoveEntry: (flag: string, typeId: number) => void;
}) {
  return (
    <div className="card-stack">
      {blocks.map((block) => (
        <div className="card" key={block.slot}>
          <h2 className="card-title">
            {block.title} <span className="faint">{block.used} / {block.total}</span>
          </h2>
          <ul className="entry-list">
            {block.rows.map((row) => {
              const isSelected = selected !== null && selected.slot === row.slot && selected.index === row.index;
              return (
                <li
                  key={row.key}
                  className={`slot-row${row.typeId === null ? " empty" : ""}${row.over ? " over" : ""}${isSelected ? " selected" : ""}`}
                >
                  <button
                    type="button" className="slot-main" aria-pressed={isSelected}
                    aria-label={`Select ${row.name} in ${block.title} slot ${row.index + 1}`}
                    onClick={() => onSelect(row.slot, row.index)}
                  >
                    {row.iconUrl === null
                      ? <span className="module-icon" aria-hidden="true" />
                      /* eslint-disable-next-line @next/next/no-img-element */
                      : <img className="module-icon" src={row.iconUrl} alt="" />}
                    <span>{row.name}</span>
                    {row.charge === null ? null : <span className="slot-charge"> · {row.charge.name}</span>}
                  </button>
                  <AffectedBy label="CPU" value={row.cpu} rows={row.cpuExplain} />
                  <AffectedBy label="Powergrid" value={row.power} rows={row.powerExplain} />
                  {row.state !== null && row.states.length > 1 ? (
                    <select
                      className="fit-select" value={row.state} aria-label={`${row.name} state`}
                      onChange={(e) => onState(row.slot, row.index, e.target.value as FitItemState)}
                    >
                      {row.states.map((state) => (
                        <option key={state} value={state}>{STATE_LABELS[state]}</option>
                      ))}
                    </select>
                  ) : <span />}
                  {row.charge === null ? <span /> : (
                    <button
                      type="button" className="icon-btn" aria-label={`Unload ${row.charge.name}`}
                      onClick={() => onClearCharge(row.slot, row.index)}
                    ><IconX size={14} /></button>
                  )}
                  {row.typeId === null ? <span /> : (
                    <button
                      type="button" className="icon-btn danger" aria-label={`Remove ${row.name}`}
                      onClick={() => onRemove(row.slot, row.index)}
                    ><IconTrash size={14} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

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
    </div>
  );
}
