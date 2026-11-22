import Link from "next/link";
import { PageHead } from "../components/PageHead.js";

/** Spec §6: an engine exception on a sheet is logged and the page says so instead of crashing. */
export function CouldNotCompute({ title }: { title: string }) {
  return (<>
    <Link href="/ships" className="yo-back">All ships</Link>
    <PageHead title={title} />
    <section className="yo-card">
      <p className="yo-empty">Could not compute this fit — the error was logged.</p>
    </section>
  </>);
}
