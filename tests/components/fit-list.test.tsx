import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FitList } from "../../src/app/fitting/FitList.js";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const INDEX = {
  rows: [{ id: 7, name: "Cheap Rifter", typeName: "Rifter", pilot: "TrilliumONE",
           updated: "2 h ago", value: "8.0M ISK", unpriced: null }],
  fittings: [{ id: 55, label: "Saved Rifter" }],
  ships: [{ id: 1000, label: "Scarlet Dart" }],
};

let posts: { url: string; body: unknown }[] = [];
let deletes: string[] = [];

beforeEach(() => {
  posts = []; deletes = []; push.mockClear(); refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "DELETE") { deletes.push(url); return { ok: true, status: 204 } as Response; }
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return { ok: true, status: 201, json: async () => ({ fit: { id: 9 }, unresolved: [] }) } as Response;
    }
    return { ok: true, status: 200, json: async () => ({
      types: [{ id: 587, name: "Rifter", groupId: 25, categoryId: 6, marketGroupId: null, metaGroup: null, metaLevel: null }],
    }) } as Response;
  }) as typeof fetch;
});

describe("FitList", () => {
  it("lists the saved fits", () => {
    render(<FitList index={INDEX} characterId={669539978} />);
    expect(screen.getByText("Cheap Rifter")).toBeInTheDocument();
    expect(screen.getByText("8.0M ISK")).toBeInTheDocument();
  });

  it("creates a new fit from a hull search and opens it", async () => {
    render(<FitList index={INDEX} characterId={669539978} />);
    fireEvent.click(screen.getByRole("button", { name: "New fit" }));
    fireEvent.change(screen.getByLabelText("Search hulls"), { target: { value: "rifter" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "New Rifter fit" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "New Rifter fit" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/fitting/9"));
    expect(posts[0]).toMatchObject({ url: "/api/fits", body: { name: "Rifter", shipTypeId: 587, characterId: 669539978 } });
  });

  it("imports EFT text and reports unresolved lines", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      posts.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return { ok: true, status: 201,
        json: async () => ({ fit: { id: 9 }, unresolved: ["Damage Controll II"] }) } as Response;
    }) as typeof fetch;

    render(<FitList index={INDEX} characterId={669539978} />);
    fireEvent.click(screen.getByRole("button", { name: "Import EFT" }));
    fireEvent.change(screen.getByLabelText("EFT text"), { target: { value: "[Rifter, x]\nDamage Controll II\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(screen.getByText(/Damage Controll II/)).toBeInTheDocument());
    expect(posts[0].url).toBe("/api/fits/import");
  });

  it("clones from a saved fitting and from an assembled ship", async () => {
    render(<FitList index={INDEX} characterId={669539978} />);
    fireEvent.change(screen.getByLabelText("From saved fittings"), { target: { value: "55" } });
    await waitFor(() => expect(posts[0]).toMatchObject({
      url: "/api/fits/from-fitting", body: { characterId: 669539978, fittingId: 55 } }));

    fireEvent.change(screen.getByLabelText("From my ships"), { target: { value: "1000" } });
    await waitFor(() => expect(posts[1]).toMatchObject({
      url: "/api/fits/from-asset", body: { characterId: 669539978, itemId: 1000 } }));
  });

  it("deletes a fit and refreshes the list", async () => {
    render(<FitList index={INDEX} characterId={669539978} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete Cheap Rifter" }));
    await waitFor(() => expect(deletes).toEqual(["/api/fits/7"]));
    expect(refresh).toHaveBeenCalled();
  });
});
