# Task: Notes glass opacity and app icon clarity

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; exact time not recorded)

## Done
- Made the Notes body darker and less transparent while retaining its frosted glass blur.
- Removed the broad reflection from the Notes body and restored a soft reflection on the fixed-height header.
- Changed the Windows icon fallback to request the large icon when the jumbo shell icon is unavailable, avoiding enlargement of the small icon.
- Restarted Still Live Development so the native icon change is loaded.

## Files
- `still-desktop/src/canvas.css`
- `still-desktop/src-tauri/src/app_picker.rs`

## Checks
- `pnpm build` passed; Vite reported its existing large-chunk warning.
- `cargo check` passed.
- `git diff --check` passed.
- Tests not run.

## Handoff
- The Rust icon extraction now uses the large-icon fallback; Windows shell icons can still vary in source quality across installed applications.
- Live Development is running from this checkout at `http://127.0.0.1:4318/`.
