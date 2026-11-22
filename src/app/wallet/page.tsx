import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { loadWallet } from "../../lib/pages/wallet.js";
import { pickActive } from "../../lib/view/characters.js";
import { CharacterPicker } from "../components/CharacterPicker.js";
import { NoCharacter } from "../components/NoCharacter.js";
import { PageHead } from "../components/PageHead.js";
import { Tabs } from "../components/Tabs.js";
import { JournalTable, TransactionsTable } from "./WalletTables.js";

export default async function WalletPage() {
  const [session, characters] = await Promise.all([readSession(), listCharacters()]);
  const character = pickActive(characters, session?.activeCharacterId ?? null);
  if (character === null) return <NoCharacter title="Wallet" />;

  const { summary, journal, transactions } = await loadWallet(character.id);

  return (<>
    <PageHead title="Wallet" aside={
      <div className="wt-balance-box">
        <span className="yo-label">Balance</span>
        {summary.balance === null
          ? <span className="wt-balance-figure is-none">Not synced yet</span>
          : <span className="wt-balance-figure">{summary.balance} <span className="wt-balance-unit">ISK</span></span>}
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
