"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group } from "@mantine/core";

/** Dates arrive as `stamp()` strings: this is a client component and the server owns the format. */
export interface PhoneView { id: number; deviceName: string; email: string; created: string; lastUsed: string }

/** Phones signed in through the Android app. Revoking one ends its token at once. */
export function PhonesPanel({ phones }: { phones: PhoneView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function revoke(phone: PhoneView) {
    if (!window.confirm(`Revoke "${phone.deviceName}"? The app on that phone will have to sign in again.`)) return;
    setBusy(true);
    await fetch(`/api/app-sessions/${phone.id}`, { method: "DELETE" });
    setBusy(false); router.refresh();
  }
  return (
    <div className="card">
      <h2 className="card-title">Signed-in phones</h2>
      {phones.length === 0 ? <p className="faint">No phone is signed in. The Android app appears here after its first sign-in.</p> : (
        <table className="table">
          <thead><tr><th>Device</th><th>Created</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {phones.map((phone) => (
              <tr key={phone.id}>
                <td>{phone.deviceName}<div className="muted">{phone.email}</div></td>
                <td className="muted">{phone.created}</td>
                <td className="muted">{phone.lastUsed}</td>
                <td>
                  <Group justify="flex-end">
                    <Button size="xs" variant="subtle" color="red" disabled={busy} aria-label={`Revoke ${phone.deviceName}`} onClick={() => void revoke(phone)}>Revoke</Button>
                  </Group>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
