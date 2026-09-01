"use client";
import { Menu } from "@mantine/core";
import { IconPlus, IconSettings, IconLogout, IconAlertTriangle } from "@tabler/icons-react";
import { portraitUrl, type CharacterGroup } from "../../lib/view/characters.js";

export function CharacterSwitcher({ groups, activeId, pathname }: { groups: CharacterGroup[]; activeId: number | null; pathname: string }) {
  const active = groups.flatMap((g) => g.characters).find((c) => c.id === activeId) ?? null;
  return (
    <Menu position="bottom-end" width={260} withinPortal shadow="md" transitionProps={{ duration: 0 }}>
      <Menu.Target>
        <button type="button" className="user-menu" aria-label="Character menu">
          {active
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={portraitUrl(active.id)} alt="" className={`char-avatar${active.tokenStatus === "needs_reauth" ? " warn" : ""}`} />
            : <span className="user-avatar"><IconPlus size={16} /></span>}
          <span className="user-name">{active ? active.name : "Add character"}</span>
          <span className="user-caret" aria-hidden="true" />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {groups.map((g) => (
          <div key={g.label}>
            <div className="char-group-label">{g.label}</div>
            {g.characters.map((c) => (
              <form key={c.id} method="post" action="/auth/switch">
                <input type="hidden" name="characterId" value={c.id} />
                <input type="hidden" name="next" value={pathname} />
                <Menu.Item component="button" type="submit"
                  // eslint-disable-next-line @next/next/no-img-element
                  leftSection={<img src={portraitUrl(c.id)} alt="" className="char-avatar" style={{ width: 24, height: 24 }} />}
                  rightSection={c.tokenStatus === "needs_reauth" ? <span className="neg" title="Re-authorise in Settings"><IconAlertTriangle size={14} /> re-authorise</span> : null}
                  data-active={c.id === activeId || undefined}>
                  {c.name}
                </Menu.Item>
              </form>
            ))}
          </div>
        ))}
        <Menu.Divider />
        {/* Plain anchors, not Menu.Item: Mantine's MenuItem hard-codes role="menuitem" on its
            root element (overriding any role prop), which would strip these of their native
            link semantics. Rendered here as ordinary links styled to match. */}
        <a href="/auth/start" className="menu-link-item"><IconPlus size={16} /> Add character</a>
        <a href="/settings" className="menu-link-item"><IconSettings size={16} /> Settings</a>
        <form method="post" action="/auth/logout">
          <Menu.Item component="button" type="submit" color="red" leftSection={<IconLogout size={16} />}>Logout</Menu.Item>
        </form>
      </Menu.Dropdown>
    </Menu>
  );
}
