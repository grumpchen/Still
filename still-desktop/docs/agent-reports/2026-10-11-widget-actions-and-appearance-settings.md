# Task: widget-actions-and-appearance-settings

- Agent: Codex (model not recorded)
- Time: 2026-10-11T20:03:11+13:00

## Done
- Added independent General Settings switches for Apps Attach, Detach, and Save-to-tray header actions; all default hidden.
- Added the Screenshot widget plugin with global, selected tag-color, and closed scopes. Tag-color selection applies only to workspace widget screenshot controls.
- Added Quiet Minimal solid, transparent, and dots backgrounds, plus an explicit Leaf photo · Liquid Glass choice using the existing bundled wallpaper.
- Restored an always-visible widget tray surface in Quiet Minimal.
- Migrated persisted preferences to workspace state v6, with safe defaults for older state.

## Files
- `src/domain/workspaces.ts`, `src/domain/screenshotPlugin.ts`, `src/domain/widgetPlugins.ts`
- `src/App.tsx`, `src/WorkspaceCanvas.tsx`, `src/GeneralSettings.tsx`, `src/AppearanceSettings.tsx`
- `src/styles.css`, `src/canvas.css`
- Focused settings, migration, rendered-header, and appearance tests.

## Checks
- `node --test --test-concurrency=1 tests/*.test.mjs` — 187 passed, 0 failed.
- Focused post-adjustment settings/header tests — 33 passed, 0 failed.
- `node_modules/.bin/tsc.cmd --noEmit` — passed.
- `node_modules/.bin/vite.cmd build` — passed.
- `git diff --check` — passed; Git reported only its usual line-ending normalization notices.
- No Rust files changed; no Rust checks were needed.

## Handoff
- Windows GUI behavior was not exercised, and no Tauri executable was built. Verify transparent rendering and the Liquid Glass wallpaper in the integration session.
- Changes are committed on the task branch; not pushed or merged.
