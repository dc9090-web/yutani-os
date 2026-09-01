import Link from "next/link";

/** Spec §6: an engine exception on a sheet is logged and the page says so instead of crashing. */
export function CouldNotCompute({ title }: { title: string }) {
  return (<>
    <h1 className="page-title">{title}</h1>
    <div className="card coming-soon">
      Could not compute this fit — the error was logged. <Link href="/ships">Back to Ships</Link>
    </div>
  </>);
}
