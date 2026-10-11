# Task: Apps startup relaunch

- Agent: Codex
- Time: 2026-10-11T19:13:27+13:00

## Done
- Diagnosis: workspace parsing unconditionally cleared ppPanelOpen, so a saved Apps widget reached the existing Relaunch button state instead of the automatic startup launch path.
- Preserved open intent only when the Apps widget has a validated saved app shortcut. Unsaved direct HWND attachments still require reattachment; Manual Widget Relaunch still defers the card renderer and its app launch.
- Added regression coverage for saved intent, unsaved attachments, and restored native minimum dimensions.

## Files
- src/domain/workspaces.ts
- 	ests/app-panel.test.mjs

## Checks
- 
ode --test tests/app-panel.test.mjs — passed, 13 tests.
- 
ode --test tests/apps-widget-present.test.mjs tests/widget-relaunch.test.mjs tests/workspaces-relaunch-migration.test.mjs — passed, 18 tests.
- pnpm --config.verifyDepsBeforeRun=false check — passed.
- pnpm --config.verifyDepsBeforeRun=false test — passed, 183 tests.
- pnpm --config.verifyDepsBeforeRun=false build — passed.
- pnpm --config.verifyDepsBeforeRun=false tauri build --no-bundle — passed, Windows executable produced. No Rust source changed.
- New executable copied to C:\Users\haoka\Projects\Default Project\Still-Widget-Relaunch-Fix-2026-10-11.exe; not launched. Live GUI behavior remains unverified.

## Handoff
- No push, merge, or GitHub release was performed.
