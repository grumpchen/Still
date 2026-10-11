# Task: Glass background and plugin status controls

- Agent: Codex
- Time: 2026-10-11T22:03:18+13:00 (Pacific/Auckland)

## Done
- Fixed workspace background selection so transparent and dots preserve the active Liquid Glass material; selecting Leaf Photo still enables Liquid Glass.
- Refactored Tag Color Status to discover selectable controls from the widget-plugin registry. Each registered control supplies its own status-card renderer, so new plugin controls become available and stack vertically without editing the status widget.
- Added Screenshot settings as a status-card control, including global/tag-color/off scope and per-color selection.

## Files
- `src/domain/appearance.ts`, `src/AppearanceSettings.tsx`
- `src/domain/widgetPlugins.ts`, `src/WidgetPluginStatusControls.tsx`, `src/TagColorStatusWidget.tsx`
- `src/WorkspaceCanvas.tsx`, `src/App.tsx`, `src/canvas.css`
- `tests/app-settings.test.mjs`, `tests/widget-relaunch.test.mjs`

## Checks
- `node_modules/.bin/tsc.cmd --noEmit` — passed.
- `node --test tests/app-settings.test.mjs tests/widget-relaunch.test.mjs tests/settings-dialog.test.mjs tests/workspaces-relaunch-migration.test.mjs` — 26 passed, 0 failed.
- `node_modules/.bin/vite.cmd build` — passed.
- `node_modules/.bin/tauri.cmd build --no-bundle` — passed; produced `src-tauri/target/release/still-desktop.exe` (15,257,088 bytes). The pre-build dependency-install hook emitted a pnpm workspace-hoist warning, but the configured TypeScript/Vite build and Rust release compilation completed successfully.
- `git diff --check` — passed before report generation.
- Live Windows GUI behavior was not exercised.

## Handoff
- The executable is a local build artifact and was not run, committed, or uploaded. No push or merge was performed.
