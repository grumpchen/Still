# Task: Show attached app logo

- Agent: Codex GPT-6
- Time: 2026-10-12T15:37:58+13:00 (Pacific/Auckland)

## Done
- Quick Ctrl+Shift attach now requests the app icon for the captured HWND/PID through an authorized native command.
- Source-free attached widgets now retain validated PNG icon data, so the app's logo appears in its widget header and is included when an app shortcut is saved.
- Added regression coverage for icon retention and exact-identity lookup wiring.

## Files
- `still-desktop/src-tauri/src/app_picker.rs`
- `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src/App.tsx`
- `still-desktop/src/domain/appPicker.ts`
- `still-desktop/src/platform/appPanel.ts`
- `still-desktop/tests/app-picker.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd exec node --test tests/app-picker.test.mjs` — 8 passed, 0 failed.
- `pnpm.cmd build` — passed.
- `cargo test --offline -- --test-threads=1` — 59 passed, 0 failed, 1 ignored.
- `cargo fmt --check` — unavailable because the stable Rust toolchain does not have the `rustfmt` component installed.
- `git diff --check` — passed.
- Live Windows visual acceptance — not performed.

## Handoff
- Verify the actual attached app icon in the live Windows integration session. The icon retrieval falls back gracefully if Windows cannot provide a valid PNG.
