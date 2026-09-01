import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor, act } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { serialiseMeta, serialiseTypes } from "../../src/lib/dogma/serialize.js";
import { resetDogmaStore } from "../../src/lib/fits/client-data.js";
import { AUTOSAVE_MS, FitEditor } from "../../src/app/fitting/FitEditor.js";
import { CATEGORY } from "../../src/lib/dogma/index.js";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const data = fixtureData("rifter");
const META = serialiseMeta(data, 3484357);
const ALL_TYPES = serialiseTypes(data);
const SKILL_IDS = ALL_TYPES.filter((t) => t.categoryId === CATEGORY.skill).map((t) => t.id);

let puts: { url: string; body: unknown }[] = [];

const GUN = { typeId: 2889, quantity: 1, flag: "HiSlot0", chargeTypeId: null, state: "active" as const };
const FIT = {
  id: 7, name: "Cheap Rifter", description: "", shipTypeId: 587, characterId: null,
  items: [0, 1, 2].map((i) => ({ ...GUN, flag: `HiSlot${i}` })),
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetDogmaStore();
  puts = [];
  push.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT" || init?.method === "POST") {
      puts.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, status: 200, json: async () => ({ fit: FIT }) } as Response;
    }
    const body =
      url.startsWith("/api/dogma/meta") ? META
      : url.startsWith("/api/dogma/types") ? { build: 3484357, types: ALL_TYPES }
      : url.startsWith("/api/sde/types") && url.includes("category=16")
        ? { types: SKILL_IDS.map((id) => ({ id })) }
      : url.startsWith("/api/sde/market-groups") ? { groups: [] }
      : url.startsWith("/api/market/prices") ? { prices: {} }
      : url.includes("q=damage") ? { types: [{ id: 2048, name: "Damage Control II", groupId: 60, categoryId: 7, marketGroupId: 615, metaGroup: "Tech II", metaLevel: 5 }] }
      : url.includes("q=autocannon") ? { types: [{ id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroup: "Tech II", metaLevel: 5 }] }
      : { types: [] };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
});
afterEach(() => { vi.useRealTimers(); });

async function renderEditor() {
  render(<FitEditor fit={FIT} characters={[{ id: 669539978, name: "TrilliumONE" }]} bonuses={[]} />);
  // All skills V by default (characterId null), so the first gauge is the all-V number.
  await waitFor(() => expect(screen.getByText("20.25 / 162.50 tf")).toBeInTheDocument());
}

describe("FitEditor", () => {
  it("computes the fit in the browser and shows no problems at All skills V", async () => {
    await renderEditor();
    expect(screen.getByText("10.80 / 51.25 MW")).toBeInTheDocument();
    expect(screen.getByText(/No problems/)).toBeInTheDocument();
  });

  it("adding a module updates the CPU gauge, and taking it offline gives the CPU back", async () => {
    await renderEditor();
    // Damage Control II costs 30 tf at every skill level: 20.25 → 50.25.
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "damage" } });
    await waitFor(() => expect(screen.getByText("Damage Control II")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Fit Damage Control II" }));
    await waitFor(() => expect(screen.getByText("50.25 / 162.50 tf")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Damage Control II state"), { target: { value: "offline" } });
    await waitFor(() => expect(screen.getByText("20.25 / 162.50 tf")).toBeInTheDocument());

    // A fourth gun over-fills the three high slots, so the slot problem appears.
    expect(screen.getByText(/No problems/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "autocannon" } });
    // The three already-fitted guns also render "200mm AutoCannon II" as their slot name, so
    // scope to the item browser card — the same within(...) pattern Task 14/15 already ruled on.
    const browser = screen.getByText("Items").closest(".card") as HTMLElement;
    await waitFor(() => expect(within(browser).getByText("200mm AutoCannon II")).toBeInTheDocument());
    fireEvent.click(within(browser).getByRole("button", { name: "Fit 200mm AutoCannon II" }));
    await waitFor(() => expect(screen.getByText("Slots")).toBeInTheDocument());
  });

  it("autosaves two seconds after the last edit and says so", async () => {
    await renderEditor();
    fireEvent.change(screen.getByLabelText("Fit name"), { target: { value: "Renamed" } });
    expect(puts).toHaveLength(0);
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_MS + 10); });
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0].url).toBe("/api/fits/7");
    expect(puts[0].body).toMatchObject({ name: "Renamed", characterId: null });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("switching to a character changes the missing-skill list", async () => {
    await renderEditor();
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/characters/")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ skills: [], implants: [] }) } as Response);
      }
      if (init?.method === "PUT") return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ build: 3484357, types: ALL_TYPES, prices: {}, groups: [], attributes: [], effects: [] }) } as Response);
    }) as typeof fetch;

    fireEvent.change(screen.getByLabelText("Pilot"), { target: { value: "669539978" } });
    await waitFor(() => expect(screen.getByText("Minmatar Frigate")).toBeInTheDocument());
    expect(screen.getByText("No skills synced yet — every skill is treated as level 0, so these numbers are worst case."))
      .toBeInTheDocument();
  });

  it("exports the fit as EFT text", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Export EFT" }));
    const box = screen.getByLabelText("EFT text") as HTMLTextAreaElement;
    expect(box.value.startsWith("[Rifter, Cheap Rifter]")).toBe(true);
    expect(box.value).toContain("200mm AutoCannon II");
    expect(box.value).toContain("[Empty Low slot]");
  });

  it("keeps the local state and says so when the save fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderEditor();
    globalThis.fetch = (async () => ({ ok: false, status: 500, json: async () => ({}) } as Response)) as typeof fetch;
    fireEvent.change(screen.getByLabelText("Fit name"), { target: { value: "Renamed" } });
    await act(async () => { vi.advanceTimersByTime(AUTOSAVE_MS + 10); });
    await waitFor(() => expect(screen.getByText(/Could not save/)).toBeInTheDocument());
    expect((screen.getByLabelText("Fit name") as HTMLInputElement).value).toBe("Renamed");
    logged.mockRestore();
  });
});
