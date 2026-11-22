import { listAccounts } from "../../lib/db/accounts.js";
import { listCharacters } from "../../lib/db/characters.js";
import { latestRuns } from "../../lib/db/sync-runs.js";
import { listAppSessions } from "../../lib/db/app-sessions.js";
import { stamp } from "../../lib/view/format.js";
import { getSdeMeta } from "../../lib/sde/repo.js";
import { listTags, tagsByCharacter } from "../../lib/db/tags.js";
import { toCharacterView } from "../../lib/view/characters.js";
import { AccountsPanel } from "./AccountsPanel.js";
import { CharactersPanel } from "./CharactersPanel.js";
import { StaticDataPanel } from "./StaticDataPanel.js";
import { SyncStatus } from "./SyncStatus.js";
import { TagsPanel } from "./TagsPanel.js";
import { PhonesPanel } from "./PhonesPanel.js";
import { PageHead } from "../components/PageHead.js";
import { AuthoriseError } from "./AuthoriseError.js";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const [accounts, characters, runs, sdeMeta, tags, tagsByChar, phones, query] = await Promise.all([
    listAccounts(), listCharacters(), latestRuns(), getSdeMeta(), listTags(), tagsByCharacter(), listAppSessions(), searchParams,
  ]);
  const error = typeof query.error === "string" && query.error !== "" ? query.error : null;
  const names = Object.fromEntries(characters.map((c) => [c.id, c.name]));
  // tagsByChar maps id -> sorted names; characters' tag chips need ids, so translate through the
  // (unique) name -> id lookup rather than adding a second tags repo query.
  const tagIdByName = new Map(tags.map((t) => [t.name, t.id]));
  const characterTagIds: Record<number, number[]> = {};
  for (const c of characters) {
    const ids = (tagsByChar.get(c.id) ?? []).map((n) => tagIdByName.get(n)).filter((id): id is number => id !== undefined);
    if (ids.length > 0) characterTagIds[c.id] = ids;
  }
  return (<>
    <PageHead title="Settings" sub="Accounts, characters, static data and sync status." />
    <AuthoriseError error={error} />
    <div className="card-grid settings-grid">
      <AccountsPanel accounts={accounts} />
      <CharactersPanel characters={characters.map(toCharacterView)} accounts={accounts} tags={tags} characterTags={characterTagIds} />
    </div>
    <div className="card-grid settings-grid">
      <TagsPanel tags={tags} />
      <StaticDataPanel meta={sdeMeta} />
    </div>
    <PhonesPanel phones={phones.map((p) => ({
      id: p.id, deviceName: p.deviceName, email: p.email, created: stamp(p.createdAt),
      lastUsed: p.lastUsedAt === null ? "never" : stamp(p.lastUsedAt),
    }))} />
    <div className="card"><h2 className="card-title">Sync status</h2><SyncStatus runs={runs} names={names} /></div>
  </>);
}
