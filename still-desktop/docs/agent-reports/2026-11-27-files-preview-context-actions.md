# Task: Files preview context actions

- Agent: Codex
- Time: 2026-11-27, UTC

## Done
- Removed duplicate Files study action rows and grouped readable-file AI actions, including PDF highlighting, under one AI tools dropdown.
- Added right-click menus to folder file previews and captured file previews. Menus expose actions supported by the current resource and call existing handlers.
- Consolidated captured file toolbar actions into a File actions dropdown and removed the redundant Files refresh arrow.

## Files
- `src/FilesWidget.tsx`
- `src/DocumentWidget.tsx`
- `src/canvas.css`
- `src/localization.tsx`
- `tests/files-preview-context-actions.test.mjs`

## Checks
- `pnpm exec tsx --test --test-concurrency=1 tests/files-preview-context-actions.test.mjs tests/files-preview-lifecycle.test.mjs` — passed (7 tests).
- `pnpm check` — passed.
- `git diff --check` — passed.

## Handoff
- WorkspaceCanvas and platform/workbench AI context were not changed. Native file actions remain gated by existing native capability checks.
