import { loadOverview } from "../lib/pages/overview.js";
import { CharacterCard } from "./components/CharacterCard.js";
import { NoCharacter } from "./components/NoCharacter.js";
import { PageHead } from "./components/PageHead.js";
import { StatStrip } from "./components/StatStrip.js";

export default async function Overview() {
  const { cards, summary } = await loadOverview(new Date());
  if (cards.length === 0) return <NoCharacter title="Overview" />;

  return (<>
    <PageHead title="Overview" sub={`${cards.length} character${cards.length === 1 ? "" : "s"} authorised`} />
    <StatStrip label="Account summary" cells={[
      { label: "Combined wallet", value: summary.wallet ?? "—", unit: summary.wallet === null ? undefined : "ISK" },
      { label: "Total skill points", value: summary.totalSp ?? "—", unit: summary.totalSp === null ? undefined : "SP" },
      { label: "Training queues", value: summary.queuesActive, unit: `of ${summary.queuesTotal} active` },
      summary.next === null
        ? { label: "Next skill completes", value: "—" }
        : { label: "Next skill completes", value: summary.next.time, unit: summary.next.name, unitIsText: true },
    ]} />
    <section className="ov-grid" aria-label="Characters">
      {cards.map((card) => <CharacterCard key={card.id} card={card} />)}
    </section>
  </>);
}
