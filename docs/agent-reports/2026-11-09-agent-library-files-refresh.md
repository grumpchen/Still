# Task: Refresh Files after reviewed agent Library changes

- Agent: Codex
- Time: 2026-11-09T12:12:00+13:00

## Done
- Successful reviewed agent note and folder creation now dispatches a local change event for the exact Notes widget whose Library was changed.
- The matching Files widget reloads its Library listing; other Notes widgets ignore the event. Creation failures and proposals awaiting review do not announce a change.
- Added a regression test covering widget scoping and automatic listing refresh.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/tests/widget-relaunch.test.mjs`

## Checks
- `pnpm check` from `still-desktop` — passed.
- `node --check tests/widget-relaunch.test.mjs` — passed.
- `git diff --check` — passed.
- `node --import tsx --test --test-concurrency=1 --test-name-pattern="reviewed agent Library changes refresh" tests/widget-relaunch.test.mjs` — passed (1 test, 209 seconds; Vite/Node startup is unusually slow).
- No native desktop test was run for this UI refresh change.

## Handoff
- The matching Notes widget refresh is verified in the component harness. Native user-visible refresh remains unverified.
