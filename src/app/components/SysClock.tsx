"use client";
import { useEffect, useState } from "react";

/** "2026-10-01 · 13:25 UTC" */
export function utcStamp(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`;
}

/**
 * The strip's UTC clock. Like QueueCountdown, the first client render repeats the server's string
 * so hydration matches, then an effect ticks it once a minute.
 */
export function SysClock({ initial }: { initial: string }) {
  const [text, setText] = useState(() => utcStamp(new Date(initial)));
  useEffect(() => {
    const tick = () => setText(utcStamp(new Date()));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return <span className="dur">{text}</span>;
}
