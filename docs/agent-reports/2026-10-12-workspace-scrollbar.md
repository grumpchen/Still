# Task: Fix workspace horizontal scrollbar

- Agent: Codex
- Time: 2026-10-12T17:28:27+13:00 (Pacific/Auckland)

## Done
- Removed the standard `scrollbar-width: thin` declaration from the Workspace viewport because Chromium prioritizes it over the custom WebKit scrollbar rules.
- Kept native scrolling and the existing 4px custom horizontal scrollbar/hidden buttons.
- Added a regression test to prevent the override from returning.

## Files
- `still-desktop/src/canvas.css`
- `still-desktop/tests/workspace-scrollbar.test.mjs`

## Checks
- `node --test tests/workspace-scrollbar.test.mjs` — passed.
- `pnpm check` — passed.
- `pnpm test` — passed, 207 tests.
- `pnpm build` — passed.
- `git diff --check` — passed.
- Windows GUI rendering was not rerun in this task.

## Handoff
- Local commit only; not pushed. Verify the scrollbar appearance in the live Windows app.