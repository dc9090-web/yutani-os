import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { PlanEditor, AUTOSAVE_MS } from "../../src/app/skills/PlanEditor.js";
import type { PlanSkill } from "../../src/lib/skills/catalogue.js";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const CATALOGUE: PlanSkill[] = [
  { id: 3300, name: "Gunnery", groupId: 255, groupName: "Gunnery", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
  { id: 3318, name: "Weapon Upgrades", groupId: 255, groupName: "Gunnery", rank: 2, primaryAttr: 167, secondaryAttr: 166, prereqs: [{ skillId: 3300, level: 2 }], alphaMaxLevel: 4 },
  { id: 3327, name: "Spaceship Command", groupId: 257, groupName: "Spaceship Command", rank: 1, primaryAttr: 167, secondaryAttr: 168, prereqs: [], alphaMaxLevel: 5 },
];
const CONTEXT = {
  base: { charisma: 18, intelligence: 20, memory: 18, perception: 21, willpower: 22 },
  implantBonus: { charisma: 0, intelligence: 0, memory: 0, perception: 0, willpower: 0 },
  trained: [] as [number, number][], queued: [] as [number, number][], partialSp: [] as [number, number][],
  queueEndsAt: "2026-09-10T00:00:00.000Z", bonusRemaps: 2, accruedRemapCooldownDate: null,
  attributesSane: true, synced: true,
};
const PLAN = {
  id: 7, characterId: 669539978, name: "Gunnery", remap: null,
  entries: [{ skillId: 3300, level: 3, note: null }],
};
const NOW = "2026-09-01T00:00:00.000Z";

let puts: unknown[] = [];
let optimiseCalls = 0;

afterEach(() => { vi.useRealTimers(); });

beforeEach(() => {
  puts = []; optimiseCalls = 0; refresh.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/optimise")) {
      optimiseCalls += 1;
      return { ok: true, status: 200, json: async () => ({
        remap: { charisma: 17, intelligence: 17, memory: 17, perception: 27, willpower: 21 },
        totalMs: 409_600_000, currentMs: 480_000_000, savedMs: 70_400_000, candidates: 2885,
      }) } as Response;
    }
    if (url.includes("/export")) {
      return { ok: true, status: 200, text: async () => "Gunnery I\nGunnery II\nGunnery III\n" } as Response;
    }
    puts.push({ url, body: JSON.parse(String(init?.body)) });
    return { ok: true, status: 200, json: async () => ({ plan: PLAN }) } as Response;
  }) as typeof fetch;
});

const editor = (over: Partial<React.ComponentProps<typeof PlanEditor>> = {}) =>
  render(<PlanEditor plan={PLAN} characterName="TrilliumONE" catalogue={CATALOGUE}
                     context={CONTEXT} accountBlock={null} now={NOW} {...over} />);

describe("PlanEditor", () => {
  it("expands the stored entries and totals them", () => {
    editor();
    expect(screen.getByDisplayValue("Gunnery")).toBeInTheDocument();
    expect(screen.getByText("TrilliumONE")).toBeInTheDocument();
    // Gunnery I..III = 8,000 SP at perception 21 + willpower 22/2 = 32 SP/min = 250 min.
    expect(screen.getAllByRole("row")).toHaveLength(4);
    // Both the totals card and the last row's cumulative cell read the same span.
    expect(screen.getAllByText("4 h 10 m").length).toBeGreaterThan(0);
  });

  it("adds a skill and inserts its prerequisites", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Search skills"), { target: { value: "weapon" } });
    fireEvent.click(await screen.findByRole("button", { name: "Add Weapon Upgrades IV" }));
    // Gunnery I, II, III already there; Weapon Upgrades I..IV appended, no duplicate Gunnery rows.
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(8));
    // Scoped to the plan table (standing ruling): the picker's own "weapon" search result is a
    // separate, expected 5th match outside this region and is asserted below.
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText("Weapon Upgrades")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Add Weapon Upgrades IV" })).toBeInTheDocument();
  });

  it("removes and re-levels a stored entry", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Raise Gunnery III" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(5));   // now I..IV
    fireEvent.click(screen.getByRole("button", { name: "Remove Gunnery IV" }));
    await waitFor(() => expect(screen.getByText("No entries yet — add a skill to start planning.")).toBeInTheDocument());
  });

  it("autosaves the entries two seconds after the last change", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Raise Gunnery III" }));
    expect(puts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({
      url: "/api/skill-plans/7",
      body: { name: "Gunnery", entries: [{ skillId: 3300, level: 4, note: null }] },
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("skips autosave while the name is empty, then saves once it is valid again", async () => {
    editor();
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "" } });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    expect(puts).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Gunnery Plan" } });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toMatchObject({ url: "/api/skill-plans/7", body: { name: "Gunnery Plan" } });
  });

  it("shows an error line in the export modal when the export fetch fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/export")) return { ok: false, status: 500 } as Response;
      puts.push({ url, body: JSON.parse(String(init?.body)) });
      return { ok: true, status: 200, json: async () => ({ plan: PLAN }) } as Response;
    }) as typeof fetch;
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Could not export — try again.")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("shifts the timeline to the end of the queue", async () => {
    editor();
    expect(screen.getAllByText("2026-09-01 04:10").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("After current queue"));
    await waitFor(() => expect(screen.getAllByText("2026-09-10 04:10").length).toBeGreaterThan(0));
  });

  it("asks for an optimal remap, shows the saving and stores it when toggled", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Find optimal remap" }));
    await waitFor(() => expect(optimiseCalls).toBe(1));
    expect(await screen.findByText("19 h 33 m")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Plan with this remap"));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 50);
    await waitFor(() => expect(puts.some((p) =>
      (p as { body: { remap?: unknown } }).body.remap !== undefined)).toBe(true));
  });

  it("shows the account-rule banner", () => {
    editor({ accountBlock: { name: "Reacher-9", until: "2026-09-20T00:00:00.000Z" } });
    expect(screen.getByText(/Reacher-9 is training until 2026-09-20 00:00/)).toBeInTheDocument();
  });

  it("exports through the route after flushing the pending save", async () => {
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    // `findByDisplayValue`/`getByText` run the default whitespace normalizer, which collapses the
    // embedded newlines in multi-line plan text — asserting `.value` directly bypasses that.
    await waitFor(() => expect(screen.getByLabelText("Plan text")).toHaveValue(
      "Gunnery I\nGunnery II\nGunnery III\n"));
  });

  it("warns when the character has never been synced", () => {
    editor({ context: { ...CONTEXT, synced: false } });
    expect(screen.getByText(/No skills synced yet/)).toBeInTheDocument();
  });
});
