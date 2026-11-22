import { describe, it, expect } from "vitest";
import { iskCompact, overviewSummary } from "../../src/lib/view/overview.js";

const now = new Date("2026-11-22T04:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

describe("iskCompact", () => {
  it("shortens to k, M and B", () => {
    expect(iskCompact(160_000_000)).toBe("160.00M");
    expect(iskCompact(1_236_000_000)).toBe("1.24B");
    expect(iskCompact(12_500)).toBe("12.5k");
    expect(iskCompact(950.4)).toBe("950");
    expect(iskCompact(0)).toBe("0");
  });
});

describe("overviewSummary", () => {
  it("sums wallets and SP, counts active queues and names the next completion", () => {
    const summary = overviewSummary([
      { name: "TrilliumONE", balance: 50_000_000, totalSp: 112_500_000, headFinish: at(44) },
      { name: "Sasha-9999", balance: 20_000_000, totalSp: 25_500_000, headFinish: at(7.5) },
      { name: "Reacher-9", balance: 15_000_000, totalSp: 4_800_000, headFinish: null },
    ], now);
    expect(summary).toEqual({
      wallet: "85.00M", totalSp: "142.8M", queuesActive: 2, queuesTotal: 3,
      next: { time: "7h 30m", name: "Sasha-9999" },
    });
  });
  it("does not count a head that has already finished (ESI has not caught up) as active", () => {
    const summary = overviewSummary([{ name: "A", balance: 1, totalSp: 1, headFinish: at(-2) }], now);
    expect(summary.queuesActive).toBe(0);
    expect(summary.next).toBeNull();
  });
  it("leaves wallet and SP unknown, not zero, when nothing has synced", () => {
    const summary = overviewSummary([{ name: "A", balance: null, totalSp: null, headFinish: null }], now);
    expect(summary.wallet).toBeNull();
    expect(summary.totalSp).toBeNull();
    expect(summary.queuesTotal).toBe(1);
  });
  it("sums only the characters that have a figure", () => {
    const summary = overviewSummary([
      { name: "A", balance: 2_000_000, totalSp: null, headFinish: null },
      { name: "B", balance: null, totalSp: 3_000_000, headFinish: null },
    ], now);
    expect(summary.wallet).toBe("2.00M");
    expect(summary.totalSp).toBe("3.0M");
  });
});
