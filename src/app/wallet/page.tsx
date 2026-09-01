import { readSession } from "../../lib/auth/session.js";
import { listCharacters } from "../../lib/db/characters.js";
import { getWallet } from "../../lib/db/character-wallet.js";
import { pickActive } from "../../lib/view/characters.js";
import { isk } from "../../lib/view/format.js";
import { loadJournalViews, loadTransactionViews } from "../../lib/view/wallet.js";
import { NoCharacter } from "../components/NoCharacter.js";
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
    <h1 className="page-title">Wallet</h1>
    <p className="page-sub">{character.name}</p>
    <div className="card-stack">
      <div className="card">
        <h2 className="card-title">Balance</h2>
        <span className="stat-value">{wallet === null ? "Not synced yet" : isk(wallet.balance)}</span>
      </div>
      <div className="card">
        <h2 className="card-title">Journal</h2>
        <JournalTable characterId={character.id} initial={journal} />
      </div>
      <div className="card">
        <h2 className="card-title">Transactions</h2>
        <TransactionsTable characterId={character.id} initial={transactions} />
      </div>
    </div>
  </>);
}
