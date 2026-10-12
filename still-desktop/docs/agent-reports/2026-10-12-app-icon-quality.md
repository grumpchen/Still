# Task: Improve app logo quality

- Agent: Codex
- Time: 2026-10-12T16:17:53+13:00

## Done
- App picker now asks Windows for the jumbo application image and exports a 128×128 PNG, retaining icon extraction fallbacks.
- Increased validated icon limits so sharper art can be retained by Apps widgets and saved Groups.
- Applied the compact circular checkbox style application-wide, with filled checked state and visible keyboard focus.

## Files
- `src-tauri/src/app_picker.rs`
- `src-tauri/Cargo.toml`
- `src/domain/appPicker.ts`
- `src/domain/workspaces.ts`
- `src/canvas.css`
- `tests/app-picker.test.mjs`
- `tests/group-tray.test.mjs`
- `tests/settings-dialog.test.mjs`

## Checks
- `pnpm exec tsc --noEmit` — passed (also run by `pnpm build`).
- `node --test tests/app-picker.test.mjs tests/group-tray.test.mjs tests/settings-dialog.test.mjs` — 31 passed, 0 failed.
- `pnpm build` — passed.
- `cargo test --bin still-desktop app_picker::tests::` — 8 passed, 0 failed, including shell jumbo icon retrieval and 128×128 PNG output.
- `cargo fmt --check` — unavailable because `rustfmt` is not installed for the active toolchain.
- Live Still GUI appearance was not checked. No release executable was built.

## Handoff
- Windows supplies the source artwork; apps without a jumbo icon continue through the existing extraction and HWND icon fallbacks.
- DPI-specific live rendering and the final visual comparison remain for desktop preview/integration.
