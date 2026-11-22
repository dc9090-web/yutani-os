"use client";
import { Menu } from "@mantine/core";
import { IconAlertTriangle, IconLogout, IconPlus, IconSettings, IconUser } from "@tabler/icons-react";
import type { ShellAccount } from "./Shell.js";

/**
 * The header's account button (redesign hand-off): the owner's initials and a chevron, nothing
 * else. It is not the character switcher — that is the dropdown under each page title
 * (`CharacterSelect`). The menu keeps what the old character menu also held: add a character,
 * settings, the re-authorise warning and logout.
 */
export function AccountMenu({ account }: { account: ShellAccount }) {
  const label = account.initials === null ? "Account menu" : `Account menu, ${account.initials}`;
  return (
    <Menu position="bottom-end" width={240} withinPortal shadow="md" transitionProps={{ duration: 0 }}>
      <Menu.Target>
        <button type="button" className="account-btn" aria-label={label}>
          <span className="account-tile" aria-hidden="true">
            {account.initials ?? <IconUser size={16} stroke={1.5} />}
          </span>
          {account.needsReauth > 0 ? <span className="account-warn" aria-hidden="true" /> : null}
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3" /></svg>
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {/* Plain anchors, not Menu.Item: Mantine's MenuItem hard-codes role="menuitem" on its root
            element, which would strip these of their native link semantics. */}
        {account.needsReauth === 0 ? null : (
          <a href="/settings" className="menu-link-item menu-link-warn">
            <IconAlertTriangle size={16} />
            {account.needsReauth} character{account.needsReauth === 1 ? "" : "s"} to re-authorise
          </a>
        )}
        <a href="/auth/start" className="menu-link-item"><IconPlus size={16} /> Add character</a>
        <a href="/settings" className="menu-link-item"><IconSettings size={16} /> Settings</a>
        <Menu.Divider />
        <form method="post" action="/auth/logout">
          {/* closeMenuOnClick={false}: Mantine closes the dropdown synchronously on click and React
              flushes that before the browser runs the button's default action, so a submit button
              that has just left the DOM has no form owner and never submits. */}
          <Menu.Item component="button" type="submit" closeMenuOnClick={false} leftSection={<IconLogout size={16} />}>Logout</Menu.Item>
        </form>
      </Menu.Dropdown>
    </Menu>
  );
}
