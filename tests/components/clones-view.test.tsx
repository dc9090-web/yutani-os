import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ClonesView } from "../../src/app/clones/ClonesView.js";
import type { CloneLocationView, CloneView, ImplantView } from "../../src/lib/view/clones.js";

const implant = (typeId: number, name: string, slot: number | null, bonus: string | null = null, desc: string | null = null): ImplantView => ({ typeId, name, slot, bonus, desc });
const clone = (implants: ImplantView[]): CloneView => ({
  implants, used: implants.length,
  slots: Array.from({ length: 10 }, (_, i) => implants.some((x) => x.slot === i + 1)),
});

const active = clone([
  implant(9899, "Ocular Filter - Improved", 1, "+5 Perception", "Improves perception."),
  implant(9941, "Squire Power Grid EG-602", 6),
]);
const locations: CloneLocationView[] = [
  {
    key: "60003760", title: "Jita", station: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", system: { name: "Jita", sec: "0.9", secClass: "sec-high" },
    clones: [
      { ...clone([implant(1, "Low-grade Snake Alpha", 1, "+2 Perception", "Part of the Snake set.")]), jumpCloneId: 1001, code: "JC 01", name: null },
      { ...clone([]), jumpCloneId: 1002, code: "JC 02", name: "Empty spare" },
    ],
  },
  { key: "60001234", title: "Kubinen", station: "Kubinen VI - Moon 2 - Lai Dai Corporation Factory", system: { name: "Kubinen", sec: "0.4", secClass: "sec-low" }, clones: [{ ...clone([implant(2, "Gypsy CPU EE-603", 6)]), jumpCloneId: 1003, code: "JC 03", name: null }] },
];
const ui = () => render(<ClonesView synced home={{ name: "Jita IV - Moon 4 - Caldari Navy Assembly Plant", system: { name: "Jita", sec: "0.9", secClass: "sec-high" } }} active={active} locations={locations} />);

describe("ClonesView", () => {
  it("shows the active clone: badge, implant count, home station, slot strip and implants", () => {
    ui();
    const panel = screen.getByRole("region", { name: "Active clone" });
    expect(within(panel).getByText("ACTIVE")).toBeInTheDocument();
    expect(within(panel).getByText("2 implants fitted")).toBeInTheDocument();
    expect(within(panel).getByText("Home station").nextElementSibling).toHaveTextContent("0.9 Jita IV - Moon 4 - Caldari Navy Assembly Plant");
    expect(within(panel).getByText("0.9")).toHaveClass("yo-sec", "sec-high");
    const strip = within(panel).getByRole("img", { name: "2 of 10 implant slots used" });
    expect(strip.children).toHaveLength(10);
    expect([...strip.children].map((c) => c.classList.contains("is-filled"))).toEqual([true, false, false, false, false, true, false, false, false, false]);
    expect(within(panel).getByText("2 / 10")).toBeInTheDocument();
    expect(within(panel).getByText("+5 Perception")).toHaveClass("cl-bonus");
    expect(within(panel).getByTitle("Slot 6").parentElement).toHaveTextContent("6Squire Power Grid EG-602");
  });

  it("groups jump clones by station with a clone count each", () => {
    ui();
    const jump = screen.getByRole("region", { name: "Jump clones" });
    expect(within(jump).getByText("3 clones · 2 stations")).toBeInTheDocument();
    expect(within(jump).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["0.9 Jita", "0.4 Kubinen"]);
    expect(within(jump).getByText("0.4")).toHaveClass("sec-low");
    expect(within(jump).getByText("2 clones")).toBeInTheDocument();
    expect(within(jump).getByText("1 clone")).toBeInTheDocument();
  });

  it("opens the first clone and lets the others open alongside it", () => {
    ui();
    expect(screen.getByText("Low-grade Snake Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Gypsy CPU EE-603")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /JC 03/ }));
    expect(screen.getByText("Gypsy CPU EE-603")).toBeInTheDocument();
    expect(screen.getByText("Low-grade Snake Alpha")).toBeInTheDocument();
  });

  it("names a clone, or says it is unnamed, and says so when it has no implants", () => {
    ui();
    expect(screen.getAllByText("Jump clone")[0]).toHaveClass("is-unnamed");
    expect(screen.getByText("Empty spare")).not.toHaveClass("is-unnamed");
    fireEvent.click(screen.getByText("Empty spare").closest("button")!);
    expect(screen.getByText("No implants")).toBeInTheDocument();
    expect(screen.getByText("0 / 10 slots")).toBeInTheDocument();
  });

  it("opens an implant's description inline, one at a time across the page", () => {
    ui();
    fireEvent.click(screen.getByRole("button", { name: "About Ocular Filter - Improved" }));
    expect(screen.getByText("Improves perception.")).toHaveClass("yo-info-panel");
    fireEvent.click(screen.getByRole("button", { name: "About Low-grade Snake Alpha" }));
    expect(screen.queryByText("Improves perception.")).toBeNull();
    expect(screen.getByText("Part of the Snake set.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "About Squire Power Grid EG-602" })).toBeNull();
  });

  it("covers a clean active clone, no jump clones, and an unsynced character", () => {
    const { rerender } = render(<ClonesView synced home={null} active={clone([])} locations={[]} />);
    expect(screen.getByText("No implants fitted")).toBeInTheDocument();
    expect(screen.getByText("No jump clones.")).toBeInTheDocument();
    expect(screen.getByText("Home station").nextElementSibling).toHaveTextContent("—");
    rerender(<ClonesView synced={false} home={null} active={clone([])} locations={[]} />);
    expect(screen.getByText(/Not synced yet/)).toBeInTheDocument();
    expect(screen.queryByText("Jump clones")).toBeNull();
  });
});
