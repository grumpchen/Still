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
- The focused Node test process produced no output and remained idle beyond the usual startup window, so it was stopped. The added regression test is not yet verified by execution.
- No native desktop test was run for this UI refresh change.

## Handoff
- The Files widget now has a refresh signal after approved agent mutations. Verify the regression test and native user-visible refresh in a later desktop pass; no claim is made that either has passed yet.
