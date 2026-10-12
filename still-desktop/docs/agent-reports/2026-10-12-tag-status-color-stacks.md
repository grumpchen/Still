# Task: Stack plugin settings by tag color

- Agent: Codex
- Time: 2026-10-12T16:33:56+13:00

## Done
- Tag Color Status now lets each color rule stack plugin settings from a dropdown. Auto relaunch and Screenshot are registered color settings; adding another plugin setting is an extension of that registry.
- Added persisted per-color Screenshot overrides. Follow global, Camera enabled, and Camera disabled affect only that tag; other tags retain their existing policy.
- The All colors follow global switch clears per-color settings and overrides. Older relaunch color rules remain readable.
- Kept checkbox controls compact and circular throughout the app.

## Files
- `src/WidgetPluginStatusControls.tsx`
- `src/domain/widgetPlugins.ts`
- `src/domain/screenshotPlugin.ts`
- `src/domain/workspaces.ts`
- `src/App.tsx`
- `src/WorkspaceCanvas.tsx`
- `src/canvas.css`
- `tests/widget-relaunch.test.mjs`
- `tests/app-settings.test.mjs`

## Checks
- `pnpm exec tsc --noEmit` — passed.
- Focused relaunch, settings, and Tag Color Status tests — 22 passed, 0 failed.
- `pnpm build` — passed.
- `pnpm test` — 194 passed, 1 failed. `tests/inlineTray.test.mjs` expects a Focus entry in expanded Group content; that test's tray behavior is outside the changed files. Running the test alone reproduces the same failure.
- No Rust changes were made for this task.

## Handoff
- The one full-suite failure remains for integration follow-up. Live desktop appearance was not verified.
