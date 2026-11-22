import Link from "next/link";
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadShips } from "../../lib/pages/ships.js";
import { pickActive } from "../../lib/view/characters.js";
import type { ShipCardView } from "../../lib/view/ships.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { Tabs } from "../components/Tabs.js";
import { ShipPanel } from "./ShipPanel.js";

function PanelList({ cards, empty, label, noun }: { cards: ShipCardView[]; empty: string; label: string; noun: [string, string] }) {
  return (
    <section className="sp-list" aria-label={label}>
      {cards.length === 0 ? <p className="yo-empty">{empty}</p> : (<>
        {cards.map((card) => <ShipPanel key={card.key} card={card} />)}
        <span className="sp-foot">{cards.length} {cards.length === 1 ? noun[0] : noun[1]}, ordered by hull type</span>
      </>)}
    </section>
  );
}

/**
 * Ships (redesign hand-off, PAGES.md §4): Fitted ships and Saved fits as two tabs, one full-width
 * panel per ship, ordered by hull type (largest first) and then by value.
 */
export default async function ShipsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const { ships, fits, skillsSynced } = await loadShips(character.id);

  const picker = <CharacterPicker characters={characters} activeId={character.id} />;
  const banner = skillsSynced ? null : (
    <p className="yo-banner">
      No skills synced yet — every skill is treated as level 0, so fitting numbers and missing-skill
      counts are worst case. The skills job runs hourly.
    </p>
  );

  return (
    <Tabs title="Ships" label="Ship lists" tabs={[
      {
        id: "fitted", label: "Fitted ships", count: ships.length, lead: picker,
        content: (<>
          {banner}
          <PanelList cards={ships} label="Fitted ships" noun={["fitted ship", "fitted ships"]}
            empty="No assembled ships in your assets yet — the assets job runs hourly." />
        </>),
      },
      {
        id: "saved", label: "Saved fits", count: fits.length, lead: picker,
        content: (<>
          {banner}
          {/* Fitting left the navigation; the designer (new, import, delete) is reached from here. */}
          <div className="sp-toolbar">
            <span className="sp-foot">Fits saved in game, and the fits you design here.</span>
            <Link href="/fitting" className="yo-btn">Fitting designer</Link>
          </div>
          <PanelList cards={fits} label="Saved fits" noun={["saved fit", "saved fits"]}
            empty="No saved fits — the fittings job runs every 6 hours." />
        </>),
      },
    ]} />
  );
}
