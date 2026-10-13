# Task: settings glass and readability

- Agent: Codex
- Time: 2026-10-13 22:27 NZDT (UTC+13)

## Done
- Separated settings helper text from its labels and normalized the Liquid Glass font stack to Segoe UI.
- Added clearer frosted surfaces to settings rows, tabs, and the Settings dialog.
- Added a saved Appearance option for Liquid Glass widget headers; it can be turned off independently.
- Continued the shared widget relaunch scope control across General and Widget Plugins settings.

## Files
- `src/styles.css`, `src/canvas.css`, `src/AppearanceSettings.tsx`, `src/WidgetRelaunchScope.tsx`
- `src/GeneralSettings.tsx`, `src/WidgetPluginsSettings.tsx`, `src/App.tsx`, `src/domain/appearance.ts`
- `tests/appearance.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; Vite reported its existing large-chunk advisory.
- `node --test tests/app-settings.test.mjs` — 10 passed.
- Glass-header default/persistence parse check — passed.
- `git diff --check` — passed with line-ending notices for existing modified files.
- `tests/appearance.test.mjs` — existing stale assertions for `browserWidth`/`browserHeight` fail because `parseState` does not preserve those fields; glass preference assertions pass before that point.

## Handoff
- Changes remain uncommitted because this checkout already contains a broad set of unrelated in-progress edits; avoid bundling them into a task commit.
