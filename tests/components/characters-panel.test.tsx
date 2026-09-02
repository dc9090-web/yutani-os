import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { CharactersPanel } from "../../src/app/settings/CharactersPanel.js";
import type { CharacterView } from "../../src/lib/view/characters.js";
import type { Account } from "../../src/lib/db/accounts.js";
import type { Tag } from "../../src/lib/db/tags.js";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const CHARACTERS: CharacterView[] = [
  { id: 669539978, name: "TrilliumONE", accountId: null, corporationName: "Caldari Navy", allianceName: null, tokenStatus: "ok" },
];
const ACCOUNTS: Account[] = [{ id: 1, name: "Main" }];
const TAGS: Tag[] = [{ id: 1, name: "Miner" }, { id: 2, name: "Scanner" }];

let calls: { url: string; method: string; body?: unknown }[] = [];

beforeEach(() => {
  calls = []; refresh.mockClear();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return { ok: true, status: 204 } as Response;
  }) as typeof fetch;
});

const ui = (characterTags: Record<number, number[]>) => render(
  <MantineProvider>
    <CharactersPanel characters={CHARACTERS} accounts={ACCOUNTS} tags={TAGS} characterTags={characterTags} />
  </MantineProvider>,
);

describe("CharactersPanel tag assignment", () => {
  it("shows every tag as a chip, marking the assigned ones", () => {
    ui({ 669539978: [1] });
    const row = screen.getByText("TrilliumONE").closest<HTMLElement>(".char-row") ?? document.body;
    const minerChip = within(row).getByRole("button", { name: "Miner" });
    const scannerChip = within(row).getByRole("button", { name: "Scanner" });
    expect(minerChip).toHaveAttribute("aria-pressed", "true");
    expect(scannerChip).toHaveAttribute("aria-pressed", "false");
  });

  it("PUTs the full tag id set when a chip is toggled on", async () => {
    ui({ 669539978: [1] });
    fireEvent.click(screen.getByRole("button", { name: "Scanner" }));
    await waitFor(() => expect(calls[0]).toMatchObject({
      url: "/api/characters/669539978/tags", method: "PUT", body: { tagIds: [1, 2] },
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("PUTs the remaining tag id set when a chip is toggled off", async () => {
    ui({ 669539978: [1, 2] });
    fireEvent.click(screen.getByRole("button", { name: "Miner" }));
    await waitFor(() => expect(calls[0]).toMatchObject({
      url: "/api/characters/669539978/tags", method: "PUT", body: { tagIds: [2] },
    }));
  });
});
