import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getPrices } from "../../lib/db/market-prices.js";
import { locationLabels } from "../../lib/names/index.js";
import { loadFitData } from "../../lib/ships/load.js";
import { getRaces, getTypes } from "../../lib/sde/repo.js";
import { pickActive } from "../../lib/view/characters.js";
import { assembledShips, assetShipCards, savedFitCards } from "../../lib/view/ships.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { ShipCard } from "./ShipCard.js";

export default async function ShipsPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Ships" />;

  const { assets, fittings, ctx, skillsSynced } = await loadFitData(character.id);
  const groups = assembledShips(assets, ctx.data);
  const byItemId = new Map(assets.map((a) => [a.itemId, a]));

  // Two batched lookups for the whole page: one price query over every type the character owns or
  // has in a fitting, and one locationLabels pass over the places the ships are parked in. Ships
  // sitting inside another item are labelled from the asset rows, never from locationLabels.
  const priceIds = [
    ...assets.map((a) => a.typeId),
    ...fittings.flatMap((f) => [f.shipTypeId, ...f.items.map((i) => i.typeId)]),
  ];
  // Ship identity pills (design hand-back) need each hull's race, which `DogmaData` doesn't carry —
  // one extra `getTypes` batch over just the hull ids, joined against the (tiny, unfiltered) race table.
  const hullTypeIds = [...new Set([...groups.map((g) => g.ship.typeId), ...fittings.map((f) => f.shipTypeId)])];
  const [prices, places, hullTypes, races] = await Promise.all([
    getPrices(priceIds),
    locationLabels(groups.filter((g) => g.ship.locationType !== "item").map((g) => g.ship.locationId)),
    getTypes(hullTypeIds),
    getRaces(),
  ]);
  const raceNames = new Map<number, string>();
  for (const [typeId, type] of hullTypes) {
    const raceName = type.raceId === null ? undefined : races.get(type.raceId);
    if (raceName !== undefined) raceNames.set(typeId, raceName);
  }

  const ships = assetShipCards(groups, ctx, places, byItemId, prices, raceNames);
  const fits = savedFitCards(fittings, ctx, prices, raceNames);

  return (<>
    <h1 className="page-title">Ships</h1>
    <p className="page-sub">{character.name}</p>
    {skillsSynced ? null : (
      <p className="card banner">
        No skills synced yet — every skill is treated as level 0, so fitting numbers and missing-skill
        counts are worst case. The skills job runs hourly.
      </p>
    )}
    <h2 className="section-title">Fitted ships</h2>
    {ships.length === 0
      ? <p className="faint">No assembled ships in your assets yet — the assets job runs hourly.</p>
      : <div className="card-grid ships">{ships.map((card) => <ShipCard key={card.key} card={card} />)}</div>}
    <h2 className="section-title">Saved fits</h2>
    {fits.length === 0
      ? <p className="faint">No saved fits — the fittings job runs every 6 hours.</p>
      : <div className="card-grid ships">{fits.map((card) => <ShipCard key={card.key} card={card} />)}</div>}
  </>);
}
