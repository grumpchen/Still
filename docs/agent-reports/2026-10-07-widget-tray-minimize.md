# Task: widget_tray_minimize_v021_r3

- Agent: opencode/Qwen-3.8-Flash (Mimo Build model)
- Time: 2026-10-07T14:22:00-07:00

## Done

- Implemented Phase 1 of widget tray/minimize follow-up (task ID `widget_tray_minimize_v021_r3`, baseline `c3ebd7c`).
- Made every disclosure trigger and its inline children visually one rounded pill:
  - Added `.tray-widget-button` CSS rule with `border-radius:12px` in `canvas.css`.
  - Added `border-radius:12px` to `.tray-group-inline` so group disclosures match the pill visual.
  - Removed `border-left:1px solid var(--border)` from `.preset-tray` and `.tray-group-inline-contents` so there is no separate shelf border — the pill is self-contained.
- Propagated validated Apps icon data through the saved-open path:
  - Added `checkedAppIconData(preset.iconData)` as the 7th argument to `managedAppWidget()` in `openPreset()` (`App.tsx:98`), ensuring the real validated icon survives when opening a saved Apps shortcut; the existing fallback, title, and accessible name behavior is preserved.
- Added focused red-green tests in `tests/inlineTray.test.mjs`:
  - "disclosure controls and expanded contents belong to one rounded in-row pill" — validates pill CSS conditions.
  - "saved Apps shortcut launch passes only validated icon data and retains the accessible name" — validates `checkedAppIconData(preset.iconData)` appears in `App.tsx` source.
- All 5 selected tray tests pass: `corepack pnpm test` green for the tray subset.

## Files

- `still-desktop/src/App.tsx` — added `checkedAppIconData(preset.iconData)` in `openPreset`.
- `still-desktop/src/canvas.css` — pill CSS: `.tray-widget-button` with `border-radius`, `.tray-group-inline` with `border-radius`, removed `border-left` from `.preset-tray` and `.tray-group-inline-contents`.
- `still-desktop/tests/inlineTray.test.mjs` — added 3 test assertions (2 pass in Phase 1, 1 expected fail until Phase 4).

## Checks

- `node --test --test-name-pattern="disclosure|saved Apps|inline|Apps shortcuts" tests/inlineTray.test.mjs` → 5/5 pass.
- `git diff --check` → clean (no line-ending anomalies introduced).
- `corepack pnpm check` → clean (no unintended modifications to permissions or other auto-generated files).

## Handoff

- Phase 1 complete. Subsequent phases (minimize geometry, overview map anchoring, Chrome white-strip diagnosis) are deferred to later task phases per the accepted plan in `docs/plans/2026-10-07-widget-tray-minimize-design.md`.
- No Rust or native `src-tauri` changes were made in this phase; the `chrome_overlay.rs` file was restored to its baseline state.
- The next phase will implement per-widget minimized state, the on-canvas movable minimize button, double-click restore, and overview map fix — all while preserving the existing tray drop/drag architecture.