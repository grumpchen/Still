# Task: live-development-preview-rebased

- Agent: Codex GPT-6
- Time: 2026-10-12T14:47:51+13:00

## Done
- Rebased the live preview setup onto the feature-complete `agent/luna/browser-overlap-visibility` HEAD `0f6c669d26961982fd5a7b84d698b1f6797afaae`, which retains Widget Relaunch, tag colors, status/plugin controls, appearance settings and the recent UI changes.
- Carried forward the installed-app icon feature from `e0474b8` and the live desktop preview setup from `8dd1976` in the isolated `agent/codex/live-preview-current` worktree on D:.
- Launched the real Tauri development app from this branch. Vite served at `127.0.0.1:4318`; Tauri watched Rust sources and logged the native capture hook as ready. Frontend HMR and Rust restart behavior are provided by Vite/Tauri's built-in development tooling.
- Kept the separate `nz.personal.still.dev` identity, WebView2 DevTools and the documented warning about not attaching one HWND to release and development apps simultaneously.

## Files
- `still-desktop/package.json`, `still-desktop/scripts/dev-desktop.mjs`, `still-desktop/src-tauri/tauri.dev.conf.json`, `still-desktop/docs/development.md`
- Installed-app logo changes: `still-desktop/src/AppWindowPicker.tsx`, `still-desktop/src/AppsWidget.tsx`, `still-desktop/src/WorkspaceCanvas.tsx`, `still-desktop/src-tauri/src/app_picker.rs`, and related permissions/tests.

## Checks
- `pnpm check`: passed.
- `pnpm build`: passed; Vite built 85 modules.
- `node --check scripts/dev-desktop.mjs`: passed.
- `node --test tests/app-picker.test.mjs`: 7/7 passed.
- `cargo test app_picker -- --nocapture`: 7/7 passed.
- `pnpm test`: 170/175 passed; five tests cannot load `jsdom`, which is imported by existing tests but is absent from `still-desktop/package.json` and the lockfile.
- `pnpm dev:desktop`: launched the debug desktop app; Tauri emitted EBUSY watcher warnings for the in-use debug EXE/PDB, then completed compilation and logged `[capture] stage=hook-install outcome=ready`. No GUI acceptance of widget visuals or external HWND behavior was performed.

## Handoff
- Run `pnpm dev:desktop` from `still-desktop`; press Ctrl+C in that terminal to stop. UI edits use Vite HMR; Rust edits trigger Tauri's native rebuild/restart.
- Development workspace data uses a separate app identity. Native attachments are transient; do not attach the same external HWND in the release and development instances simultaneously.
- Branch: `agent/codex/live-preview-current`; HEAD: `7293f8e35d6fe9f1a44eb33647fde6ceff05e88b`. No release build, merge, push, or publish was performed.
