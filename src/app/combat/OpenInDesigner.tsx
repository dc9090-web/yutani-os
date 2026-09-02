"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { IconTool } from "@tabler/icons-react";

/** Spec §6: POST the killmail, then go straight to the new fit in the phase-5 designer. */
export function OpenInDesigner({ killmailId, characterId }: { killmailId: number; characterId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/fits/from-killmail", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ killmailId, characterId }),
      });
      if (!res.ok) throw new Error(`/api/fits/from-killmail answered ${res.status}`);
      const json = (await res.json()) as { fit: { id: number } };
      router.push(`/fitting/${json.fit.id}`);
    } catch (e) {
      console.error("[combat] could not build a fit from the killmail", e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [killmailId, characterId, router]);

  return (<>
    <button type="button" className="fit-btn" disabled={busy} onClick={open}>
      <IconTool size={16} /> {busy ? "Building…" : "Open in fitting designer"}
    </button>
    {failed ? <p className="neg">Could not build a fit from this killmail.</p> : null}
  </>);
}
