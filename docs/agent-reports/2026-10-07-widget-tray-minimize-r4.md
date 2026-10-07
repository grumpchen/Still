# Task: widget_tray_minimize_r4_feedback

- Agent: Codex
- Time: 2026-10-07T13:57:19+13:00

## Done
- Removed repeated Chrome z-order promotion during scrolling and limited each Browser panel update to that panel instead of walking every managed browser.
- Cached the Chrome clipping region in window-local coordinates, so ordinary scroll movement repositions the HWND without rebuilding an unchanged overlap/viewport region. Changed intersections still generate a fresh region.
- Made each widget disclosure a single icon/name/arrow button, removed the extra collapse buttons, and removed the dark expanded-tray backing.
- Preserved the prior minimize behavior and added a native test for stable local clipping across scroll plus changed-overlap invalidation.

## Files
- `still-desktop/src-tauri/src/chrome_overlay.rs` — per-panel placement, stable region cache, and no z-order promotion for visible moves.
- `still-desktop/src/WorkspaceCanvas.tsx`, `still-desktop/src/PresetTray.tsx`, `still-desktop/src/GroupTray.tsx`, `still-desktop/src/canvas.css` — one-button tray disclosures and transparent expanded containers.
- `still-desktop/tests/inlineTray.test.mjs` — single-button/no-extra-collapse regression checks.

## Checks
- `corepack pnpm test` — 104 passed, 0 failed.
- `corepack pnpm check` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 37 passed, 0 failed, 1 ignored (the ignored test launches Chrome).
- `corepack pnpm tauri build --no-bundle` — passed; built the new r4 candidate without overwriting r3.
- Windows visual/performance acceptance for horizontal and vertical scroll and widget overlaps — pending user test.

## Handoff
- Branch: `agent/opencode/widget-tray-minimize`, based on the prior r3 commit `7f002d0d1f08c32cea8b0b9752e97de6b2cb346b`.
- Build candidate will be `still-desktop/src-tauri/target/release/ver0.21-test-widget-tray-minimize-r4.exe`; r3 is left untouched.
- No claim that the visual stripe or scroll latency is confirmed fixed until the user tests the native Chrome window. No merge, push, launch, or release acceptance performed.
