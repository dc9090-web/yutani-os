import { describe, it, expect } from "vitest";
import { serverView } from "../../src/lib/view/server.js";

const now = new Date("2026-03-14T12:00:00Z");

describe("serverView", () => {
  it("shows a recent count, grouped", () => {
    expect(serverView({ players: 23456, fetchedAt: new Date("2026-03-14T11:57:00Z") }, now))
      .toEqual({ players: 23456, label: "23,456", at: "2026-03-14T11:57:00.000Z" });
  });
  it("shows nothing before the first run", () => {
    expect(serverView(null, now)).toBeNull();
  });
  it("shows nothing once the count is more than twenty minutes old", () => {
    expect(serverView({ players: 23456, fetchedAt: new Date("2026-03-14T11:39:59Z") }, now)).toBeNull();
    expect(serverView({ players: 23456, fetchedAt: new Date("2026-03-14T11:40:00Z") }, now)).not.toBeNull();
  });
});
