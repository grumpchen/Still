# Task: Widget button visibility settings

- Agent: Codex
- Time: 2026-10-12T15:54:19+13:00 (Pacific/Auckland)

## Done
- Added persistent General Settings switches to show or hide the Relaunch and Export PNG widget-header buttons independently; both default to visible for existing layouts.
- Applied the Relaunch setting to regular and minimized widget cards. Manual-startup recovery remains available when a widget is waiting for relaunch.
- Added `jsdom` as a locked development dependency because the existing rendered-widget tests import it but the package did not declare it.

## Files
- `src/GeneralSettings.tsx`, `src/WorkspaceCanvas.tsx`, `src/App.tsx`, `src/domain/workspaces.ts`
- `tests/app-settings.test.mjs`, `tests/widget-relaunch.test.mjs`
- `package.json`, `pnpm-lock.yaml`

## Checks
- Focused settings and rendered-widget tests: 19 passed.
- Full frontend suite: 192 passed, 1 failed. The remaining failure is `tests/inlineTray.test.mjs`, which expects a Focus action in GroupEditor; current GroupEditor only contains Add widget and Add link. This task did not modify that code.
- `pnpm.cmd --config.verifyDepsBeforeRun=false check`: passed.
- `pnpm.cmd --config.verifyDepsBeforeRun=false build`: passed.
- `git diff --check`: passed.
- No Rust code or Windows GUI behavior changed or tested.

## Handoff
- Both controls are visible by default and can be toggled separately in Settings → General → Workspace widget buttons.
- The toolbar Relaunch action is hidden when disabled, while the manual-startup recovery action remains available. Export PNG remains limited to widget types that already support it (Apps cards do not show that control).
- No executable was built.
