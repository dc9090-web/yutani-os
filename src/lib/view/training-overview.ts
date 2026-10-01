import type { SkillQueueRow } from "../db/character-skills.js";
import { duration, queueProgress } from "./format.js";

/** Rows shown per character on the Skills page's Training overview (design hand-back 2026-10-01). */
export const TRAINING_OVERVIEW_LIMIT = 20;

export interface TrainingQueueRow {
  position: number;
  skill: string;
  trainedLevel: number;
  targetLevel: number;
  /** Only the head of an active queue is training; a paused head is not. */
  training: boolean;
  /** `duration()` of the time still to train; "—" when the entry has no dates (paused). */
  remaining: string;
}

export type TrainingQueueStatus =
  | { kind: "eta"; text: string }
  | { kind: "paused" }
  | { kind: "empty" }
  | { kind: "notSynced" };

export interface TrainingQueueView {
  id: number;
  name: string;
  online: boolean | null;
  status: TrainingQueueStatus;
  /** 0–1 progress of the head entry through its level; null unless the queue is actively training. */
  progress: number | null;
  /** The whole live queue's length, even when `rows` is capped. */
  count: number;
  rows: TrainingQueueRow[];
  truncated: boolean;
}

export interface TrainingQueueInput {
  id: number;
  name: string;
  online: boolean | null;
  /** False when the skills job has never written a summary for this character. */
  synced: boolean;
  /** The queue after `liveQueue()` — finished entries already dropped. */
  queue: readonly SkillQueueRow[];
}

/**
 * The same shaping as the Skills page's own queue table, for every character at once: the head
 * entry carries the progress bar, each row its time remaining, and the list stops at
 * TRAINING_OVERVIEW_LIMIT while `count` keeps the real length.
 */
export function trainingQueueView(
  input: TrainingQueueInput,
  names: ReadonlyMap<number, string>,
  now: Date,
): TrainingQueueView {
  const { queue } = input;
  const head = queue[0] ?? null;
  const active = head !== null && head.finishDate !== null;
  const last = queue.length > 0 ? queue[queue.length - 1].finishDate : null;

  let status: TrainingQueueStatus;
  if (!input.synced) status = { kind: "notSynced" };
  else if (head === null) status = { kind: "empty" };
  else if (!active || last === null) status = { kind: "paused" };
  else status = { kind: "eta", text: duration(last.getTime() - now.getTime()) };

  const rows = queue.slice(0, TRAINING_OVERVIEW_LIMIT).map((q, index) => {
    const remainingMs = q.startDate !== null && q.finishDate !== null
      ? q.finishDate.getTime() - Math.max(q.startDate.getTime(), now.getTime())
      : null;
    return {
      position: index + 1,
      skill: names.get(q.skillId) ?? `Skill ${q.skillId}`,
      trainedLevel: Math.max(0, q.finishedLevel - 1),
      targetLevel: q.finishedLevel,
      training: index === 0 && active,
      remaining: remainingMs === null ? "—" : duration(remainingMs),
    };
  });

  return {
    id: input.id,
    name: input.name,
    online: input.online,
    status,
    progress: active ? queueProgress(head, now) : null,
    count: queue.length,
    rows,
    truncated: queue.length > rows.length,
  };
}
