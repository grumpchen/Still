# Task: live-development-preview

- Agent: Codex GPT-6
- Time: 2026-10-12T14:15:51+13:00

## Done
- Added `pnpm dev:desktop`, which starts Tauri's built-in Rust watcher and the configured Vite server with verbose CLI logs and Rust backtraces.
- Added a development-only Tauri identity, title, and WebView2 DevTools setting so development localStorage, app data, and WebView2 profiles are separate from release Still.
- Documented startup, HMR, Rust restarts, stopping, persistence, and the need not to attach the same external HWND in both app instances.
- Set generated permission TOML files to LF so Tauri build output matches their checked-in format.

## Files
- `.gitattributes`
- `still-desktop/package.json`
- `still-desktop/scripts/dev-desktop.mjs`
- `still-desktop/src-tauri/tauri.dev.conf.json`
- `still-desktop/docs/development.md`

## Checks
- `node --check scripts/dev-desktop.mjs` and dev-config JSON validation: passed.
- `pnpm check`: passed.
- `pnpm build`: passed.
- `node --test tests/app-picker.test.mjs`: 7/7 passed.
- `pnpm test`: 104/109 passed; the five failures are existing canvas-height and inline-tray expectations outside this change.
- `pnpm dev:desktop`: Vite started on `127.0.0.1:4318`, Tauri compiled the debug app, and `target/debug/still-desktop.exe` launched. The CLI reported EBUSY watcher warnings for its locked debug executable/PDB during compilation; the app still launched. No live visual interaction or HWND attachment was tested.

## Handoff
- Run `pnpm dev:desktop` from `still-desktop`; press Ctrl+C in that terminal to stop.
- Use the development app for external window attachment tests and avoid attaching the same HWND in release Still at the same time.
- No release build, merge, push, or publish was performed.
