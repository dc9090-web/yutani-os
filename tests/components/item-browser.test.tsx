import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { fixtureData } from "../dogma/fixture.js";
import { serialiseMeta, serialiseTypes } from "../../src/lib/dogma/serialize.js";
import { getDogmaMeta, ensureTypes, resetDogmaStore } from "../../src/lib/fits/client-data.js";
import { ItemBrowser } from "../../src/app/fitting/ItemBrowser.js";

const data = fixtureData("rifter");
const META = serialiseMeta(data, 3484357);
const ALL_TYPES = serialiseTypes(data);

const SEARCH_RESULTS = [
  { id: 2889, name: "200mm AutoCannon II", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroup: "Tech II", metaLevel: 5 },
  { id: 484, name: "125mm Gatling AutoCannon I", groupId: 55, categoryId: 7, marketGroupId: 574, metaGroup: "Tech I", metaLevel: 0 },
];
const RIG_RESULTS = [
  // Small rig: rigSize 1, same as the Rifter. Medium rig: rigSize 2, so it does not fit.
  { id: 31686, name: "Small Projectile Collision Accelerator II", groupId: 777, categoryId: 7, marketGroupId: 1105, metaGroup: "Tech II", metaLevel: 5 },
  { id: 31682, name: "Medium Projectile Collision Accelerator I", groupId: 777, categoryId: 7, marketGroupId: 1105, metaGroup: "Tech I", metaLevel: 0 },
];
const CHARGE_RESULTS = [
  { id: 12608, name: "Hail S", groupId: 372, categoryId: 8, marketGroupId: 859, metaGroup: "Tech II", metaLevel: 5 },
  { id: 27339, name: "Caldari Navy Mjolnir Torpedo", groupId: 89, categoryId: 8, marketGroupId: 860, metaGroup: "Faction", metaLevel: 5 },
];

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetDogmaStore();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body =
      url.startsWith("/api/dogma/meta") ? META
      : url.startsWith("/api/dogma/types") ? { build: 3484357, types: ALL_TYPES }
      : url.startsWith("/api/sde/market-groups") ? { groups: [
          { id: 9, parentId: null, name: "Ship Equipment", hasTypes: false },
          { id: 574, parentId: 9, name: "Projectile Turrets", hasTypes: true },
        ] }
      : url.includes("category=8") ? { types: CHARGE_RESULTS }
      : url.includes("q=collision") ? { types: RIG_RESULTS }
      : { types: SEARCH_RESULTS };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
  await getDogmaMeta();
  await ensureTypes([587, 2889, 484, 12608, 27339, 31682, 31686, 4256]);
});
afterEach(() => { vi.useRealTimers(); });

describe("ItemBrowser", () => {
  it("searches after the debounce and lists results with their meta-group badge", async () => {
    const onFit = vi.fn();
    render(<ItemBrowser shipTypeId={587} selected={null} onFit={onFit} onCharge={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "autocannon" } });
    await waitFor(() => expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument());
    expect(screen.getByText("Tech II")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fit 200mm AutoCannon II" }));
    expect(onFit).toHaveBeenCalledWith(2889);
  });

  it("hides results that do not fit this hull while the filter is on", async () => {
    render(<ItemBrowser shipTypeId={587} selected={null} onFit={vi.fn()} onCharge={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "collision" } });
    // The filter is on by default: the Medium rig does not fit a frigate.
    await waitFor(() =>
      expect(screen.getByText("Small Projectile Collision Accelerator II")).toBeInTheDocument());
    expect(screen.queryByText("Medium Projectile Collision Accelerator I")).toBeNull();

    fireEvent.click(screen.getByLabelText("Fits this hull"));
    await waitFor(() =>
      expect(screen.getByText("Medium Projectile Collision Accelerator I")).toBeInTheDocument());
  });

  it("switches to charges for the selected module and filters by charge group", async () => {
    const onCharge = vi.fn();
    render(
      <ItemBrowser
        shipTypeId={587} selected={{ slot: "high", index: 0, typeId: 2889 }}
        onFit={vi.fn()} onCharge={onCharge}
      />);
    await waitFor(() => expect(screen.getByText("Hail S")).toBeInTheDocument());
    // The torpedo's group is not among the autocannon's chargeGroups, so it is filtered out.
    expect(screen.queryByText("Caldari Navy Mjolnir Torpedo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load Hail S" }));
    expect(onCharge).toHaveBeenCalledWith(12608);
  });

  it("walks the market-group tree", async () => {
    render(<ItemBrowser shipTypeId={587} selected={null} onFit={vi.fn()} onCharge={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ship Equipment" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ship Equipment" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Projectile Turrets" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Projectile Turrets" }));
    await waitFor(() => expect(screen.getByText("200mm AutoCannon II")).toBeInTheDocument());
  });
});
