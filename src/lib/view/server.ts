import { grouped } from "./format.js";

/** A count older than this is not shown as current: the job has been failing, or Tranquility is down. */
export const SERVER_STATUS_MAX_AGE_MS = 20 * 60 * 1000;

/** What the status strip and the phone show: the count as a number and as text ("23,456"), and when it was read. */
export interface ServerView { players: number; label: string; at: string }

/**
 * The stored count while it is fresh enough to call current, otherwise null. The job runs every five
 * minutes, so twenty minutes of silence means several failed runs in a row.
 */
export function serverView(status: { players: number; fetchedAt: Date } | null, now: Date): ServerView | null {
  if (status === null || now.getTime() - status.fetchedAt.getTime() > SERVER_STATUS_MAX_AGE_MS) return null;
  return { players: status.players, label: grouped(status.players), at: status.fetchedAt.toISOString() };
}
