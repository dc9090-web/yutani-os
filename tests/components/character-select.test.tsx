import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CharacterSelect } from "../../src/app/components/CharacterSelect.js";
import { accountTag, characterOptions } from "../../src/lib/view/characters.js";

vi.mock("next/navigation", () => ({ usePathname: () => "/ships" }));

const options = [
  { id: 1, name: "TrilliumONE", tag: "MAIN", sp: "112.5M", needsReauth: false },
  { id: 2, name: "Reacher-9", tag: "ALT", sp: "4.8M", needsReauth: true },
  { id: 3, name: "Shiono Khamsi", tag: null, sp: null, needsReauth: false },
];

describe("CharacterSelect", () => {
  it("shows the active character, closed", () => {
    render(<CharacterSelect options={options} activeId={2} />);
    const button = screen.getByRole("button", { name: "Character: Reacher-9" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
  it("lists every character with its tag and SP, and posts the switch back to this page", () => {
    render(<CharacterSelect options={options} activeId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Character: TrilliumONE" }));
    const list = screen.getByRole("listbox", { name: "Characters" });
    const rows = screen.getAllByRole("option");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
    expect(rows[0]).toHaveTextContent("TrilliumONEMAIN112.5M");
    expect(rows[1]).toHaveTextContent("Reacher-9RE-AUTHORISEALT4.8M");
    expect(rows[2]).toHaveTextContent("Shiono Khamsi—");
    const form = rows[1].closest("form")!;
    expect(form.getAttribute("action")).toBe("/auth/switch");
    expect((form.querySelector('input[name="characterId"]') as HTMLInputElement).value).toBe("2");
    expect((form.querySelector('input[name="next"]') as HTMLInputElement).value).toBe("/ships");
    expect(list).toBeInTheDocument();
  });
  it("closes on Escape and on a click outside", () => {
    render(<div><CharacterSelect options={options} activeId={1} /><p>elsewhere</p></div>);
    const button = screen.getByRole("button", { name: "Character: TrilliumONE" });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(button);
    fireEvent.mouseDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("characterOptions", () => {
  const accounts = [{ id: 1, name: "Main" }, { id: 2, name: "Alt" }];
  it("tags a character with its account's name in capitals", () => {
    expect(accountTag(1, accounts)).toBe("MAIN");
    expect(accountTag(2, accounts)).toBe("ALT");
    expect(accountTag(null, accounts)).toBeNull();
    expect(accountTag(9, accounts)).toBeNull();
  });
  it("carries total SP without a unit, or null when skills have not synced", () => {
    const rows = characterOptions(
      [{ id: 1, name: "A", accountId: 1, tokenStatus: "ok" }, { id: 2, name: "B", accountId: null, tokenStatus: "needs_reauth" }],
      accounts, new Map([[1, 112_512_000], [2, null]]),
    );
    expect(rows).toEqual([
      { id: 1, name: "A", tag: "MAIN", sp: "112.5M", needsReauth: false },
      { id: 2, name: "B", tag: null, sp: null, needsReauth: true },
    ]);
  });
});
