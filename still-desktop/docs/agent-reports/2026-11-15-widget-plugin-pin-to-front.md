# Task: Widget plugin Pin to Front

- Agent: Codex, GPT-6
- Time: 2026-11-15T02:00:33+00:00

## Done
- Added Pin to Front to the widget add-on menu and plugin catalog, with a header toggle and persistent front stacking within a workspace.
- Added bounded workspace serialization and Group collect/restore coverage for pin state and Files reading progress.
- Left widget positions and the native Windows z-order above other applications unchanged.

## Files
- `src/WorkspaceCanvas.tsx`, `src/Icon.tsx`, `src/WidgetPluginsSettings.tsx`, `src/canvas.css`
- `src/domain/widgetPlugins.ts`, `src/domain/workspaces.ts`, `src/localization.tsx`
- `tests/widget-color-tag.test.mjs`, `tests/settings-dialog.test.mjs`, `tests/group-tray.test.mjs`
- `docs/plans/2026-11-15-widget-plugin-pin-to-front.md`

## Checks
- Focused add-on, settings, workspace, Group and preset tests — 39 passed.
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reports its existing large-chunk advisory.
- `git diff --check` — passed.

## Handoff
- Pinning affects card stacking inside the active workspace only; it does not set Windows always-on-top behavior.
- Native Windows acceptance remains unavailable in this workspace.
