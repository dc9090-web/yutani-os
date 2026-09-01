"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextInput, Group } from "@mantine/core";
import type { Account } from "../../lib/db/accounts.js";

export function AccountsPanel({ accounts }: { accounts: Account[] }) {
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
      <h2 className="card-title">Accounts</h2>
      {accounts.map((a) => (
        <Group key={a.id} justify="space-between" mb="xs">
          <span>{a.name}</span>
          <Group gap="xs">
            <Button size="xs" variant="subtle" disabled={busy} onClick={() => { const n = window.prompt("Rename account", a.name); if (n) void call(`/api/accounts/${a.id}`, "PATCH", { name: n }); }}>Rename</Button>
            <Button size="xs" variant="subtle" color="red" disabled={busy} onClick={() => { if (window.confirm(`Delete account "${a.name}"? Characters are kept and become unassigned.`)) void call(`/api/accounts/${a.id}`, "DELETE"); }}>Delete</Button>
          </Group>
        </Group>
      ))}
      <Group mt="md">
        <TextInput placeholder="New account name (e.g. Main)" value={name} onChange={(e) => setName(e.currentTarget.value)} size="sm" />
        <Button size="sm" disabled={busy || !name.trim()} onClick={async () => { await call("/api/accounts", "POST", { name }); setName(""); }}>Add</Button>
      </Group>
    </div>
  );
}
