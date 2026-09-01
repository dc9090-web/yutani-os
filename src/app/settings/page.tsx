import { listAccounts } from "../../lib/db/accounts.js";
import { listCharacters } from "../../lib/db/characters.js";
import { latestRuns } from "../../lib/db/sync-runs.js";
import { toCharacterView } from "../../lib/view/characters.js";
import { AccountsPanel } from "./AccountsPanel.js";
import { CharactersPanel } from "./CharactersPanel.js";
import { SyncStatus } from "./SyncStatus.js";

export default async function SettingsPage() {
  const [accounts, characters, runs] = await Promise.all([listAccounts(), listCharacters(), latestRuns()]);
  const names = Object.fromEntries(characters.map((c) => [c.id, c.name]));
  return (<>
    <h1 className="page-title">Settings</h1>
    <p className="page-sub">Accounts, characters and sync status.</p>
    <div className="card-grid" style={{ gridTemplateColumns: "1fr 2fr", marginBottom: 20 }}>
      <AccountsPanel accounts={accounts} />
      <CharactersPanel characters={characters.map(toCharacterView)} accounts={accounts} />
    </div>
    <div className="card"><h2 className="card-title">Sync status</h2><SyncStatus runs={runs} names={names} /></div>
  </>);
}
