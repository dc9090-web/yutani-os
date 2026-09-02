"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, NativeSelect } from "@mantine/core";
import { portraitUrl, type CharacterView } from "../../lib/view/characters.js";
import type { Account } from "../../lib/db/accounts.js";
import type { Tag } from "../../lib/db/tags.js";

export function CharactersPanel({ characters, accounts, tags, characterTags }: {
  characters: CharacterView[]; accounts: Account[]; tags: Tag[]; characterTags: Record<number, number[]>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false); router.refresh();
  }
  function toggleTag(characterId: number, tagId: number) {
    const current = characterTags[characterId] ?? [];
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];
    void call(`/api/characters/${characterId}/tags`, "PUT", { tagIds: next });
  }
  return (
    <div className="card">
      <h2 className="card-title">Characters</h2>
      {characters.length === 0 ? <p className="faint">No characters yet.</p> : null}
      {characters.map((c) => (
        <div key={c.id} className="char-row" style={{ marginBottom: 12 }}>
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portraitUrl(c.id)} alt="" className={`char-avatar${c.tokenStatus === "needs_reauth" ? " warn" : ""}`} />
              <div><div>{c.name}</div><div className="faint" style={{ fontSize: 12 }}>{c.corporationName ?? "—"}{c.tokenStatus === "needs_reauth" ? <span className="badge needs_reauth" style={{ marginLeft: 8 }}>needs re-authorisation</span> : null}</div></div>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <NativeSelect size="xs" value={c.accountId ?? ""} disabled={busy}
                data={[{ value: "", label: "Unassigned" }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]}
                onChange={(e) => void call(`/api/characters/${c.id}`, "PATCH", { accountId: e.currentTarget.value ? Number(e.currentTarget.value) : null })} />
              <Button size="xs" variant="subtle" component="a" href="/auth/start">Re-authorise</Button>
              <Button size="xs" variant="subtle" color="red" disabled={busy} onClick={() => { if (window.confirm(`Remove ${c.name} and all its synced data?`)) void call(`/api/characters/${c.id}`, "DELETE"); }}>Remove</Button>
            </Group>
          </Group>
          {tags.length === 0 ? null : (
            <Group gap="xs" mt={6}>
              {tags.map((t) => {
                const assigned = (characterTags[c.id] ?? []).includes(t.id);
                return (
                  <button key={t.id} type="button" className={`tag-chip${assigned ? " on" : ""}`}
                    aria-pressed={assigned} disabled={busy} onClick={() => toggleTag(c.id, t.id)}>
                    {t.name}
                  </button>
                );
              })}
            </Group>
          )}
        </div>
      ))}
      <Button mt="md" size="sm" component="a" href="/auth/start">Add character</Button>
    </div>
  );
}
