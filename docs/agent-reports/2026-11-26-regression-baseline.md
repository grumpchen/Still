# Task: Regression baseline

- Agent: Luna regression baseline worker
- Time: 2026-11-26 13:16 UTC

## Done
- Updated stale front-end test assertions to match the current component structure, localized accessible labels, appearance schema, and interaction behavior.
- Updated persistence checks to find the intended workspace by role or ID. `parseState` inserts built-in Dashboard and Library workspaces and normalizes timetable entries with `autoOpen`.
- Kept the requested protected tests unchanged: `browser.test.mjs` and `dashboard-home-layout.test.mjs`.
- No application source changes.

## Files
- Updated 13 files under `still-desktop/tests/`.
- Added this report.

## Checks
- `pnpm install --frozen-lockfile` — passed in the isolated worktree.
- Focused test runs for updated UI and persistence tests — passed, except tests that cover functionality not present in the current source.
- `pnpm test` — 493 passed, 9 failed, 502 total. Linux full-suite result: `/tmp/luna-final3-tests.log`.
- `git diff --check` — passed.

## Remaining failures
- `tests/browser.test.mjs`: protected by task instructions; not edited.
- `tests/dashboard-home-layout.test.mjs`: protected by task instructions; not edited.
- `tests/widget-relaunch.test.mjs` — the Notes library test expects Markdown files to open in local Notes tabs. The current `NotesLibraryExplorer` previews and edits files in its explorer; its `onOpenNote` prop is not called. This is a behavior gap, so the test was not weakened.
- `tests/widget-relaunch.test.mjs` — five tests expect a Relaunch toolbar action for ordinary and Apps widgets, plus independently configurable Relaunch visibility. `WorkspaceCanvas` currently renders a Relaunch button only in `.widget-startup-waiting` for startup-deferred widgets; its props do not include `showWidgetRelaunchAction`. The manual-startup tests pass after updating their selectors to the current waiting-card button.
- `tests/workspace-controls.test.mjs` — compact focus mode is not wired in `App.tsx`; `focus-mode` CSS is residual. The sidebar chevron assertion was updated to verify the current hover reveal zone and dock rail and now passes.

## Handoff
- Branch: `agent/luna/regression-baseline`.
- The remaining failures above need source decisions or review in integration; no test was changed to mask them.
