# Task: Browser overlap visibility

- Agent: Codex
- Time: 2026-10-10T23:12:09+13:00 (Pacific/Auckland)

## Done
- Reproduced the wrong decision through a rendered BrowserWidget test: a higher Browser caused both `chrome_panel_present` requests to hide.
- Changed Browser visibility so any positive overlap from a higher card hides only the lower native Chrome window. Header-only overlap and edge touching do not hide it; moving clear restores visibility through the same Browser ID.
- Started from a new clean task worktree at the `agent/luna/group-native-visibility` baseline (`c7ae5f1af49be7641c5cdbed149bd2940910fd48`). No Apps-only changes were carried forward.
- Built a Windows candidate at `src-tauri/target/release/still-desktop.exe` (SHA-256 `D91D342CD70CA5E18144EF5AFD3CB0F45A04A87D47C60D3CD3550F83219030E3`).

## Files
- `src/domain/chromeOverlay.ts`
- `tests/chrome-overlay.test.mjs`
- `tests/browser-widget-present.test.mjs`

## Checks
- `node --test tests/browser-widget-present.test.mjs tests/chrome-overlay.test.mjs` — 8 passed.
- `npm run check` — passed.
- `npm run build` — passed.
- `npm test` — 140 tests, 138 passed, 2 failed in untouched `tests/app-picker.test.mjs` and `tests/canvas.test.mjs`.
- `npm run tauri -- build --no-bundle` — succeeded; release executable produced. Tauri's preliminary dependency install warned that the shared node_modules junction was not a real directory, then the frontend build and Rust release compilation completed.
- The supplied `Still-Sidebar-Test.exe` was inspected for metadata and SHA-256, not launched. Its ProductVersion is 0.20.0; SHA-256 `219914464FDEE750F0A9D5AD1D119AC4640521EC4978C97556BDEDF10E1912F7`.

## Handoff
- The integration session should validate the built candidate on Windows with real Chrome windows. GUI acceptance is not claimed.
