"use client";
import { IconTrash, IconX } from "@tabler/icons-react";
import type { SlotKind } from "../../lib/dogma/index.js";
import type { FitItemState } from "../../lib/fits/doc.js";
import { STATE_LABELS, type EditorSlotBlock } from "../../lib/fits/editor-view.js";
import { AffectedBy } from "../ships/AffectedBy.js";

/**
 * Spec §4's slots, redesigned per the hand-back: High/Mid/Low/Rig/Subsystem are one "Modules" card
 * (`.slot-section` per kind) instead of one card each, with a `.slot-head` column header row.
 *
 * The hand-back's specificity fix (port this!): the baseline's `.entry-list li { display: flex }`
 * (0-1-1) was beating `.slot-row`'s grid (0-1-0), so slot columns never actually lined up — hence
 * `li.slot-row` in globals.css. The row below is a bare `<li className="slot-row…">`, unchanged
 * from before this task, because the fix lives entirely in the CSS selector, not the markup.
 */
export function SlotLayout({
  blocks, selected, onSelect, onRemove, onState, onClearCharge,
}: {
  blocks: EditorSlotBlock[];
  selected: { slot: SlotKind; index: number } | null;
  onSelect: (slot: SlotKind, index: number) => void;
  onRemove: (slot: SlotKind, index: number) => void;
  onState: (slot: SlotKind, index: number, state: FitItemState) => void;
  onClearCharge: (slot: SlotKind, index: number) => void;
}) {
  return (
    <div className="card fit-modules">
      <h2 className="card-title">Modules</h2>
      <div className="slot-head" aria-hidden="true">
        <span>Module</span>
        <span className="num">CPU tf</span>
        <span className="num">PG MW</span>
        <span>State</span>
        <span></span>
        <span></span>
      </div>
      {blocks.map((block) => {
        const over = block.used > block.total;
        return (
          <div className="slot-section" key={block.slot}>
            <h3 className="slot-section-title">
              {block.title} <span className={`slot-count${over ? " over" : ""}`}>{block.used} / {block.total}</span>
            </h3>
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
                      data-desc={row.desc ?? undefined}
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
        );
      })}
    </div>
  );
}
