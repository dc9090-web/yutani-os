import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LevelBlocks, filledBlocks, queueBlocks, skillBlocks } from "../../src/app/components/LevelBlocks.js";
import { SegBar } from "../../src/app/components/SegBar.js";
import { StatStrip } from "../../src/app/components/StatStrip.js";
import { Tabs } from "../../src/app/components/Tabs.js";
import { Disclosure } from "../../src/app/components/Disclosure.js";
import { InfoButton, InfoGroup, InfoPanel } from "../../src/app/components/Info.js";
import { PageHead } from "../../src/app/components/PageHead.js";

describe("LevelBlocks", () => {
  it("fills trained levels, outlines queued ones and marks the level in training", () => {
    expect(skillBlocks(3)).toEqual(["filled", "filled", "filled", "empty", "empty"]);
    expect(skillBlocks(3, 2)).toEqual(["filled", "filled", "filled", "queued", "queued"]);
    expect(skillBlocks(3, 2, true)).toEqual(["filled", "filled", "filled", "training", "queued"]);
    expect(skillBlocks(0, 1, true)).toEqual(["training", "empty", "empty", "empty", "empty"]);
  });
  it("shows a queue entry as the levels below its target plus the target in amber", () => {
    expect(queueBlocks(4, false)).toEqual(["filled", "filled", "filled", "queued", "empty"]);
    expect(queueBlocks(1, true)).toEqual(["training", "empty", "empty", "empty", "empty"]);
    expect(queueBlocks(5, true)).toEqual(["filled", "filled", "filled", "filled", "training"]);
  });
  it("draws ten blocks for implant slots", () => {
    expect(filledBlocks(7, 10).filter((s) => s === "filled")).toHaveLength(7);
    expect(filledBlocks(7, 10)).toHaveLength(10);
  });
  it("is one labelled image", () => {
    render(<LevelBlocks states={skillBlocks(4, 1, true)} label="Level 4 of 5" />);
    const strip = screen.getByRole("img", { name: "Level 4 of 5" });
    expect([...strip.children].map((c) => c.className)).toEqual([
      "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-filled", "yo-block is-training",
    ]);
  });
});

describe("SegBar", () => {
  it("fills to the fraction, capped at the full bar, in the given tone", () => {
    const { rerender } = render(<SegBar value={0.84} label="Training progress 84%" tone="accent" />);
    const bar = screen.getByRole("img", { name: "Training progress 84%" });
    expect(bar.className).toBe("yo-bar is-accent");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("84%");
    rerender(<SegBar value={1.4} label="CPU" tone="bad" />);
    expect((screen.getByRole("img", { name: "CPU" }).firstElementChild as HTMLElement).style.width).toBe("100%");
  });
});

describe("StatStrip", () => {
  it("shows a label, figure and unit per cell", () => {
    render(<StatStrip label="Account summary" cells={[
      { label: "Total skill points", value: "254.4M", unit: "SP" },
      { label: "Next skill completes", value: "7h 22m", unit: "Sasha-9999", unitIsText: true },
    ]} />);
    expect(screen.getByRole("region", { name: "Account summary" })).toBeInTheDocument();
    expect(screen.getByText("Total skill points").nextElementSibling).toHaveTextContent("254.4M SP");
    expect(screen.getByText("Sasha-9999").className).toBe("yo-stat-unit is-text");
  });
});

describe("Tabs", () => {
  afterEach(() => history.replaceState(null, "", window.location.pathname));
  const tabs = [
    { id: "overview", label: "Overview", lead: <p>All characters</p>, content: <p>overview panel</p> },
    { id: "skills", label: "Skills", lead: <p>dropdown</p>, content: <p>skills panel</p> },
    { id: "training", label: "Training", count: 144, content: <p>training panel</p> },
  ];

  it("shows the first panel by default, with its tab selected", () => {
    render(<Tabs tabs={tabs} label="Skills views" />);
    expect(screen.getByRole("tablist", { name: "Skills views" })).toBeInTheDocument();
    expect(screen.getByText("overview panel")).toBeVisible();
    expect(screen.getByText("skills panel")).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Skills" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Training/ })).toHaveTextContent("Training144");
  });
  it("switches panel on click and records the tab in the hash", () => {
    render(<Tabs tabs={tabs} label="Skills views" />);
    fireEvent.click(screen.getByRole("tab", { name: "Skills" }));
    expect(screen.getByText("skills panel")).toBeVisible();
    expect(screen.getByText("overview panel")).not.toBeVisible();
    expect(window.location.hash).toBe("#skills");
  });
  it("opens on the tab named in the hash and ignores an unknown one", () => {
    history.replaceState(null, "", "#training");
    const { unmount } = render(<Tabs tabs={tabs} label="Skills views" />);
    expect(screen.getByText("training panel")).toBeVisible();
    unmount();
    history.replaceState(null, "", "#nope");
    render(<Tabs tabs={tabs} label="Skills views" />);
    expect(screen.getByText("overview panel")).toBeVisible();
  });
  it("with a title, draws the page head and swaps the lead with the tab", () => {
    render(<Tabs tabs={tabs} label="Skills views" title="Skills" />);
    expect(screen.getByRole("heading", { level: 1, name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText("All characters")).toBeVisible();
    expect(screen.getByText("dropdown")).not.toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Skills" }));
    expect(screen.getByText("dropdown")).toBeVisible();
    expect(screen.getByText("All characters")).not.toBeVisible();
  });
});

describe("Disclosure", () => {
  it("opens and closes on its row, several at once, and stays open when forced", () => {
    render(<>
      <Disclosure summary={<span>Jita</span>}><p>jita body</p></Disclosure>
      <Disclosure summary={<span>Amarr</span>}><p>amarr body</p></Disclosure>
      <Disclosure summary={<span>Dodixie</span>} forceOpen><p>dodixie body</p></Disclosure>
    </>);
    expect(screen.queryByText("jita body")).toBeNull();
    expect(screen.getByText("dodixie body")).toBeInTheDocument();
    const jita = screen.getByRole("button", { name: "Jita" });
    expect(jita).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(jita);
    fireEvent.click(screen.getByRole("button", { name: "Amarr" }));
    expect(screen.getByText("jita body")).toBeInTheDocument();
    expect(screen.getByText("amarr body")).toBeInTheDocument();
    expect(jita).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(jita);
    expect(screen.queryByText("jita body")).toBeNull();
  });
});

describe("Info button and panel", () => {
  it("opens the description inline, one at a time within a group", () => {
    render(<InfoGroup>
      <InfoButton id="a" name="Gunnery" /><InfoPanel id="a">Basic turret operation.</InfoPanel>
      <InfoButton id="b" name="Mechanics" /><InfoPanel id="b">Hull maintenance.</InfoPanel>
    </InfoGroup>);
    expect(screen.queryByText("Basic turret operation.")).toBeNull();
    const gunnery = screen.getByRole("button", { name: "About Gunnery" });
    fireEvent.click(gunnery);
    expect(screen.getByText("Basic turret operation.")).toBeInTheDocument();
    expect(gunnery).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "About Mechanics" }));
    expect(screen.queryByText("Basic turret operation.")).toBeNull();
    expect(screen.getByText("Hull maintenance.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "About Mechanics" }));
    expect(screen.queryByText("Hull maintenance.")).toBeNull();
  });
});

describe("PageHead", () => {
  it("renders the title with a sub-line, and an aside beside it", () => {
    render(<PageHead title="Wallet" sub="TrilliumONE" aside={<span>balance</span>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Wallet" })).toBeInTheDocument();
    expect(screen.getByText("TrilliumONE").className).toBe("page-sub");
    expect(screen.getByText("balance").parentElement?.className).toBe("yo-page-head-row");
  });
});
