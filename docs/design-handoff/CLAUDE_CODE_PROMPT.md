# Starting prompt for Claude Code

Paste this into Claude Code from the root of the repo.

---

Implement the Yutani OS visual redesign described in `docs/design-handoff/`.

Read these first, in order: `docs/design-handoff/README.md`, `DESIGN_SYSTEM.md`, `PAGES.md`, `REPO_MAPPING.md`, `DATA_AND_OPEN_ITEMS.md`. The files in `docs/design-handoff/artboards/` are the exact reference for markup, spacing and behaviour; read the relevant artboard before building each page and copy its values exactly.

Before writing code:
1. Check `REPO_MAPPING.md` against the code and tell me anything in it that is wrong or out of date.
2. Map each design component to existing templates, partials and CSS classes, and list what is new.
3. For every row in the "New data or calculations" table in `DATA_AND_OPEN_ITEMS.md`, tell me whether the app already has that data, and how you would get it if not.
4. List the open decisions from `DATA_AND_OPEN_ITEMS.md` and ask me about any that block the first step.
5. Propose a plan in small steps that follows the build order in the README. Wait for my go-ahead.

Rules:
- Work on a branch. Keep the existing stack (Next.js, the single `globals.css`, Mantine only where it is used today); do not add a framework.
- Run `npm run typecheck` and `npm test` before telling me a step is done.
- Keep all current functionality unless `PAGES.md` says it was removed.
- Build desktop and mobile together for each page; the mobile artboards are 390px wide.
- Never ship example, estimated or placeholder values. Wire the real data or leave a visible TODO in the UI and tell me.
- After each page, run the app and compare it against the artboard at desktop width and at 390px, and report differences.
