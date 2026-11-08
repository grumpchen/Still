# Task: restore the widget Relaunch control

- Agent: Codex (GPT-6)
- Time: 2026-11-09T06:00:00+13:00, Pacific/Auckland

## Done
- Reconnected the saved `showWidgetRelaunchAction` preference to General Settings and the workspace canvas. Existing saved profiles continue to default to showing it.
- Restored a Relaunch action on regular and minimized widget cards. The minimized action remains independently hidden by the same preference, and deferred startup widgets retain their in-content manual recovery action.
- Updated old Apps test selectors to match the current accessible label, and aligned outdated appearance assertions with the existing dynamic/still UI and glass migration behavior.

## Checks
- `pnpm.cmd check` — passed.
- `node --import tsx --test tests/app-settings.test.mjs tests/appearance.test.mjs` — 11 passed.
- Apps widget tests — 5 passed, including reopen and failed relaunch presentation.
- The focused WorkspaceCanvas test passed after correcting its stale PNG export label assertion.
- The live native preview was not restarted. This increment has not been visually accepted in the native app.

## Handoff
- The focused checks for this increment are complete. Full-suite and native-app visual verification remain outstanding; continue with the remaining agent robustness work.
