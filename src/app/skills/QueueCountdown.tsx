"use client";
import { useEffect, useState } from "react";
import { countdown } from "../../lib/view/format.js";

/**
 * The queue-countdown line above the queue table (design hand-back): a live `Xd Xh Xm Xs` tick to
 * the queue's final finish time. `initial` is the server-computed string for the first paint — the
 * client re-renders it unchanged on hydration, then the effect (which only runs after hydration)
 * takes over the ticking, so there is never a mismatch between the SSR HTML and the first client
 * render. `finishAt` is `null` for an empty or fully paused queue, in which case there is nothing to
 * tick towards and `initial` is shown as-is for good.
 */
export function QueueCountdown({ finishAt, initial }: { finishAt: number | null; initial: string }) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (finishAt === null) return;
    const tick = () => setText(countdown(finishAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [finishAt]);

  return (
    <p className="queue-countdown">
      <span className="faint">All skills trained in</span> <strong className="dur">{text}</strong>
    </p>
  );
}
