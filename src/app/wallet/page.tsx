import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getWallet } from "../../lib/db/character-wallet.js";
import { pickActive } from "../../lib/view/characters.js";
import { grouped } from "../../lib/view/format.js";
import { loadJournalViews, loadTransactionViews } from "../../lib/view/wallet.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { PageHead } from "../components/PageHead.js";
import { Tabs } from "../components/Tabs.js";
import { JournalTable, TransactionsTable } from "./WalletTables.js";

export default async function WalletPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Wallet" />;

  const [wallet, journal, transactions] = await Promise.all([
    getWallet(character.id),
    loadJournalViews(character.id),
    loadTransactionViews(character.id),
  ]);

  return (<>
    <PageHead title="Wallet" aside={
      <div className="wt-balance-box">
        <span className="yo-label">Balance</span>
        {wallet === null
          ? <span className="wt-balance-figure is-none">Not synced yet</span>
          : <span className="wt-balance-figure">{grouped(wallet.balance.toFixed(2))} <span className="wt-balance-unit">ISK</span></span>}
      </div>
    }>
      <CharacterPicker characters={characters} activeId={character.id} />
    </PageHead>
    {/* The tables are keyed by character: switching characters must not carry "show more" rows across. */}
    <Tabs label="Wallet views" tabs={[
      { id: "journal", label: "Journal", content: <JournalTable key={character.id} characterId={character.id} initial={journal} /> },
      { id: "transactions", label: "Transactions", content: <TransactionsTable key={character.id} characterId={character.id} initial={transactions} /> },
    ]} />
  </>);
}
