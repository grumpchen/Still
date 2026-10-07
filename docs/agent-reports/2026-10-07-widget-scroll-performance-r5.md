# Task: widget scroll performance r5

- Agent: Codex
- Time: 2026-10-07T14:13:44+13:00

## Done
- Removed per-scroll-frame callbacks that were scheduling Chrome geometry reads and native window updates on every animation frame.
- Chrome now hides once at scroll start and is positioned/shown again when scrolling settles. Partial viewport intersections remain supported after settling.
- The lag source was repeated UI/native window work, not the 150% canvas limits or a new high-memory allocation.
- The white stripe remains unverified and unresolved. Native viewport/overlap clipping regions were introduced in the 0.21 workspace-controls change; no interactive live-Chrome reproduction was available to confirm the exact stripe cause.

## Files
- `still-desktop/src/BrowserWidget.tsx`
- `still-desktop/src/platform/canvasScroll.ts`
- `still-desktop/tests/canvas-scroll.test.mjs`
- `still-desktop/tests/chrome-overlay.test.mjs`
- This report

## Checks
- Regression test was observed failing before the fix because scroll events scheduled per-event work.
- `corepack pnpm test` — 105 passed, 0 failed.
- `corepack pnpm check` — passed.
- `cargo test --manifest-path src-tauri\Cargo.toml` — 37 passed, 0 failed, 1 ignored (live Chrome GUI test).
- `corepack pnpm build` — passed.
- `corepack pnpm tauri build --no-bundle` — passed.
- Candidate SHA-256: `4CE1DE13F09CF27B06B87309ABCB8DC53D5D51EF6B46BB57A92435718CB7470C`.

## Handoff
- Test build: `still-desktop/src-tauri/target/release/ver0.21-test-widget-tray-minimize-r5.exe`.
- Minimize behavior was left intact. User should test scroll smoothness and report whether the stripe remains during overlap or only during scrolling; no merge, push, launch, or release acceptance performed.
