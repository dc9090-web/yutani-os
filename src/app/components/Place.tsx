import type { SecView } from "../../lib/view/format.js";

/**
 * A location the way every page shows one: the system's security status, coloured (teal high-sec,
 * amber low-sec, coral null-sec — the figure says it too), then the place. NPC station names
 * already begin with their system ("Jita IV - Moon 4 - …"), so the system is only spelled out in
 * front when the place's own name does not.
 */
export function Place({ name, system, className }: { name: string; system: SecView | null | undefined; className?: string }) {
  if (system == null) return <span className={className} title={name}>{name}</span>;
  const repeats = name === system.name || name.startsWith(`${system.name} `);
  return (
    <span className={className} title={repeats ? name : `${system.name} · ${name}`}>
      <span className={`yo-sec ${system.secClass}`}>{system.sec}</span>{" "}
      {repeats ? name : <><span className="yo-sec-system">{system.name}</span> · {name}</>}
    </span>
  );
}
