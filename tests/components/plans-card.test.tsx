import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlansCard, type PlanListRow } from "../../src/app/skills/PlansCard.js";
import { MAX_PLAN_NAME } from "../../src/lib/skills/parse.js";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const PLANS: PlanListRow[] = [{
  id: 7, name: "Gunnery", entries: 3, remaining: "4h 10m", doneAt: "2026-09-01 04:10",
}];
const LONG_TEMPLATE_NAME = "x".repeat(MAX_PLAN_NAME + 5);
const TEMPLATES = [
  { id: 4, name: "Minmatar Militia Fighter" }, { id: 14, name: "Manufacturer" },
  { id: 21, name: LONG_TEMPLATE_NAME },
];

let posts: { url: string; body: unknown }[] = [];
let deletes: string[] = [];
let unresolved: string[] = [];

beforeEach(() => {
  posts = []; deletes = []; unresolved = []; push.mockClear(); refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "DELETE") { deletes.push(url); return { ok: true, status: 204 } as Response; }
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return { ok: true, status: 201, json: async () => ({ plan: { id: 9 }, unresolved }) } as Response;
  }) as typeof fetch;
});

const card = (plans: PlanListRow[] = PLANS) =>
  render(<PlansCard characterId={669539978} plans={plans} templates={TEMPLATES} />);

describe("PlansCard", () => {
  it("lists the plans with their remaining time", () => {
    card();
    expect(screen.getByRole("link", { name: "Gunnery" })).toHaveAttribute("href", "/skills/plans/7");
    expect(screen.getByText("4h 10m")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01 04:10")).toBeInTheDocument();
  });

  it("says so when there are none", () => {
    card([]);
    expect(screen.getByText("No plans yet — start one with “New plan”.")).toBeInTheDocument();
  });

  it("creates an empty plan and opens it", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "New plan" }));
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Frigates" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/plans/9"));
    expect(posts[0]).toEqual({
      url: "/api/skill-plans", body: { characterId: 669539978, name: "Frigates" },
    });
  });

  it("creates a plan from a CCP template", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "From template" }));
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Create from template" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/plans/9"));
    expect(posts[0]).toEqual({
      url: "/api/skill-plans",
      body: { characterId: 669539978, name: "Minmatar Militia Fighter", templateId: 4 },
    });
  });

  it("clamps an over-long template name before creating the plan", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "From template" }));
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "21" } });
    fireEvent.click(screen.getByRole("button", { name: "Create from template" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/plans/9"));
    const body = posts[0].body as { name: string };
    expect(body.name).toHaveLength(MAX_PLAN_NAME);
    expect(body.name).toBe(LONG_TEMPLATE_NAME.slice(0, MAX_PLAN_NAME));
  });

  it("imports text and reports the lines that did not resolve", async () => {
    unresolved = ["200mm AutoCannon II"];
    card();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(screen.getByLabelText("Plan name"), { target: { value: "Pasted" } });
    fireEvent.change(screen.getByLabelText("Plan text"), { target: { value: "Gunnery V\n200mm AutoCannon II\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Import plan" }));
    expect(await screen.findByText("200mm AutoCannon II")).toBeInTheDocument();
    expect(posts[0]).toEqual({
      url: "/api/skill-plans/import",
      body: { characterId: 669539978, name: "Pasted", text: "Gunnery V\n200mm AutoCannon II\n" },
    });
  });

  it("deletes a plan and refreshes", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "Delete Gunnery" }));
    await waitFor(() => expect(deletes).toEqual(["/api/skill-plans/7"]));
    expect(refresh).toHaveBeenCalled();
  });
});
