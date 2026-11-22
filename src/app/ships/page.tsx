import Link from "next/link";
import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getPrices } from "../../lib/db/market-prices.js";
import { placeViews } from "../../lib/names/place.js";
import { loadFitData } from "../../lib/ships/load.js";
import { masteryLevel } from "../../lib/ships/mastery.js";
import { getMasteryRequirements, getRaces, getTypes } from "../../lib/sde/repo.js";
import { pickActive } from "../../lib/view/characters.js";
import { assembledShips, assetShipCards, rootLocationId, savedFitCards, sortShipPanels, type ShipCardView } from "../../lib/view/ships.js";
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

  const { assets, fittings, ctx, skillsSynced } = await loadFitData(character.id);
  const groups = assembledShips(assets, ctx.data);
  const byItemId = new Map(assets.map((a) => [a.itemId, a]));

  // Batched lookups for the whole page: one price query over every type the character owns or has
  // in a fitting, one locationLabels pass over the places the ships are parked in (ships sitting
  // inside another item are labelled from the asset rows), and one mastery query over the hulls.
  const priceIds = [
    ...assets.map((a) => a.typeId),
    ...fittings.flatMap((f) => [f.shipTypeId, ...f.items.map((i) => i.typeId)]),
  ];
  // The hull's race is not in `DogmaData` — one `getTypes` batch over the hull ids, joined against
  // the (tiny, unfiltered) race table.
  const hullTypeIds = [...new Set([...groups.map((g) => g.ship.typeId), ...fittings.map((f) => f.shipTypeId)])];
  const [prices, places, hullTypes, races, mastery] = await Promise.all([
    getPrices(priceIds),
    // Every ship's real place — a ship in a container is where the container is — with its system's security.
    placeViews(groups.map((g) => rootLocationId(g.ship, byItemId))),
    getTypes(hullTypeIds),
    getRaces(),
    getMasteryRequirements(hullTypeIds),
  ]);
  const raceNames = new Map<number, string>();
  for (const [typeId, type] of hullTypes) {
    const raceName = type.raceId === null ? undefined : races.get(type.raceId);
    if (raceName !== undefined) raceNames.set(typeId, raceName);
  }
  // Mastery is a claim about the pilot's skills: until they have synced there is nothing to say.
  const masteryOf = (typeId: number): number | null => (skillsSynced ? masteryLevel(mastery.get(typeId), ctx.skills) : null);

  const ships = sortShipPanels(assetShipCards(groups, ctx, places, byItemId, prices, raceNames, masteryOf));
  const fits = sortShipPanels(savedFitCards(fittings, ctx, prices, raceNames, masteryOf));

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
