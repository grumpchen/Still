# Task: clock popup and shortcuts collapse

- Agent: Codex
- Time: 2026-10-12T17:44:30+13:00 (Pacific/Auckland)

## Done
- The Clock timer popup prefers the space above its widget, sizes to available space, and stays outside the card; it falls below when that avoids overlap.
- Saved shortcuts in Edit widget tray now start collapsed behind an adjacent, keyboard-operable chevron.

## Files
- `src/WorkspaceCanvas.tsx`
- `src/TrayEditor.tsx`
- `src/canvas.css`
- `tests/widget-relaunch.test.mjs`
- `tests/tray-editor.test.mjs`

## Checks
- `node --test tests/widget-relaunch.test.mjs tests/tray-editor.test.mjs` — 16 passed.
- `pnpm check` — passed.
- `pnpm test` — 208 passed, 0 failed.
- `pnpm build` — passed.
- `git diff --check` — passed.

## Handoff
- Source changes only. Live Windows visual behavior was not manually checked.
