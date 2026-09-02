import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueueCountdown } from "../../src/app/skills/QueueCountdown.js";

describe("QueueCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the server-computed initial string on first paint, matching what the mount effect immediately resyncs to", () => {
    // RTL's render() flushes effects synchronously (via act), so by the time we assert, the
    // mount-time tick() has already run — this pins the clock so that tick lands on the exact
    // same value as `initial`, proving the two never disagree rather than racing to see which wins.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
    render(<QueueCountdown finishAt={Date.now() + 90_000} initial="0d 0h 1m 30s" />);
    expect(screen.getByText("0d 0h 1m 30s")).toBeInTheDocument();
  });

  it("ticks down once a second once mounted", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const finishAt = Date.now() + 5000;
    render(<QueueCountdown finishAt={finishAt} initial="0d 0h 0m 5s" />);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("0d 0h 0m 3s")).toBeInTheDocument();
  });

  it("stops ticking and shows 'Queue complete' once the target time passes", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const finishAt = Date.now() + 500;
    render(<QueueCountdown finishAt={finishAt} initial="0d 0h 0m 0s" />);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Queue complete")).toBeInTheDocument();
  });

  it("clears its interval on unmount", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const clearSpy = vi.spyOn(global, "clearInterval");
    const finishAt = Date.now() + 60_000;
    const { unmount } = render(<QueueCountdown finishAt={finishAt} initial="0d 0h 1m 0s" />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("never ticks when there is no finish time to count down to", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<QueueCountdown finishAt={null} initial="—" />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
