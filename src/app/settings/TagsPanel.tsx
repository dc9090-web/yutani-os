"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextInput, Group } from "@mantine/core";
import type { Tag } from "../../lib/db/tags.js";

export function TagsPanel({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false); router.refresh();
  }
  return (
    <div className="card">
      <h2 className="card-title">Tags</h2>
      {tags.map((t) => (
        <Group key={t.id} justify="space-between" mb="xs">
          <span>{t.name}</span>
          <Button size="xs" variant="subtle" color="red" disabled={busy} aria-label={`Delete ${t.name}`}
            onClick={() => { if (window.confirm(`Delete tag "${t.name}"? It will be removed from every character it is assigned to.`)) void call(`/api/tags/${t.id}`, "DELETE"); }}>Delete</Button>
        </Group>
      ))}
      <Group mt="md">
        <TextInput placeholder="New tag name (e.g. Miner)" value={name} onChange={(e) => setName(e.currentTarget.value)} size="sm" />
        <Button size="sm" disabled={busy || !name.trim()} onClick={async () => { await call("/api/tags", "POST", { name }); setName(""); }}>Add</Button>
      </Group>
    </div>
  );
}
