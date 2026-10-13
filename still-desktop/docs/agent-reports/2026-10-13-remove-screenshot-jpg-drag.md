# Task: remove screenshot JPG drag

- Agent: Codex
- Time: 2026-10-13 23:17 NZDT (UTC+13)

## Done
- Removed the camera-button drag-to-JPG behavior and its screenshot-to-Notes/Files drop handling, native JPG drag commands, stored image attachments, and related UI hints.
- Kept the camera button as a click-to-copy screenshot action.
- Refined the fullscreen taskbar cover to use the measured Windows taskbar height and a soft top fade.

## Files
- `src/App.tsx`, `src/WorkspaceCanvas.tsx`, `src/canvas.css`, `src/domain/workspaces.ts`, `src/widgets.tsx`
- `src/platform/capture.ts`, `src/platform/resourceDrop.ts`
- `src-tauri/src/capture.rs`, `src-tauri/src/dropped_files.rs`, `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`
- `tests/canvas.test.mjs`, `tests/fullscreen.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- `node --test tests/fullscreen.test.mjs` — 3 passed.
- `node --test tests/canvas.test.mjs tests/fullscreen.test.mjs` — fullscreen checks passed; 2 unrelated canvas fixture failures remain (v2 browser migration data and missing `widgetCatalog` entry).
- Rust check not run because Cargo is unavailable in this environment.
- Search confirmed no remaining JPG screenshot-drag or embedded-image code references.

## Handoff
- Reload/restart Still to see the refined fullscreen cover. Native fullscreen rendering was not available for visual acceptance in this turn.
