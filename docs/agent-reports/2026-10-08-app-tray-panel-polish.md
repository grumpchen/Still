# Task: app tray and native panel polish

- Agent: Codex, GPT-6.1 Sol
- Time: 2026-10-08T01:12:23+13:00

## Done
- Reused one native helper for refreshing an attached window's clip when one of its child surfaces crosses the clipped edge. Chrome and Apps now use the same region-boundary handling; this addresses the white repaint stripe without adding scrolling timers or geometry polling.
- Removed disclosure arrows and dropdown behavior from the ordinary widget buttons. Groups remain expandable. Saved shortcuts are presented in a single section after Groups, and the Apps `+` action remains available there.
- Saved app shortcuts show their stored Windows icon, with the generic app symbol as fallback. Increased the validated PNG limit while keeping it bounded. Saved Files shortcuts display the selected file or folder name.
- Prevented the collapsed sidebar navigation from overflowing horizontally and producing scrollbar arrows. Reduced its icon and badge sizing to fit the narrow rail.
- Made Attach Open App rows a consistent height and constrained the list to a contained scroll area so icons and row actions remain visible.

## Files
- `still-desktop/src-tauri/src/native_panels.rs`
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src-tauri/src/chrome_overlay.rs`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/PresetTray.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/domain/appPicker.ts`
- `still-desktop/src/domain/presets.ts`
- `still-desktop/src/domain/workspaces.ts`

## Checks
- `corepack pnpm build` — passed (TypeScript and Vite production build).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed.
- Focused native region regression: `cargo test --manifest-path src-tauri/Cargo.toml child_window_crossing_a_clipped_edge_is_detected_for_region_refresh` — passed (1 test).
- `corepack pnpm tauri build --no-bundle` — passed.
- Test candidate: `still-desktop/src-tauri/target/release/ver0.21-test-app-tray-panel-polish.exe` (SHA-256 `7D65FD0484380F097C6231CD78385EBC3620A062F54B0DAC0AE3F68EF3FD9873`). Not launched; live Windows visual acceptance remains with the user.

## Handoff
- Baseline: `5376f68ab776395a2f208ffb410fa1390707a027`; branch: `agent/codex/app-tray-panel-polish`.
- Native repaint handling now detects child HWNDs by their managed root window, so renderer children in a separate process are covered.
- This is a test candidate, not an accepted release. No merge or release was performed.
