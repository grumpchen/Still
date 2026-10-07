# Task: Phase 1 — Attach Open App and right-edge containment

- Agent: Luna
- Time: 2026-10-08T10:44:00+13:00

## Done
- Phase 1A: preserve the selected app window by exact HWND/PID when refreshing the list; make picker rows non-shrinking inside a bounded, internally scrolling dialog. Added picker selection and native identity regressions. No discovery/attach failure reproduced in source-level testing, so the native attach flow was not rewritten.
- Phase 1B: pass the workspace viewport’s right edge to Browser and Apps native presentation. After applying geometry and clip while hidden, compare the actual native HWND right edge in physical pixels and keep it hidden while it protrudes beyond the workspace edge (one physical pixel is tolerated). Native child-refresh paths enforce the same check; a safe move reuses and shows the existing window. Ordinary widget overlaps remain governed by the existing region logic. Older revisioned snapshots cannot replace newer panel state.
- Phase 1A and 1B are separate commits. The no-bundle candidate was built and copied; it was not launched.

## Files
- Phase 1A: `still-desktop/src/AppWindowPicker.tsx`, `src/domain/appPicker.ts`, `src-tauri/src/app_picker.rs`, `src/canvas.css`, `tests/app-picker.test.mjs`.
- Phase 1B: `still-desktop/src/AppsWidget.tsx`, `src/BrowserWidget.tsx`, `src/domain/appPanel.ts`, `src/domain/chromeOverlay.ts`, `src/platform/appPanel.ts`, `src/platform/chromePanel.ts`, `src-tauri/src/app_panel.rs`, `src-tauri/src/chrome_overlay.rs`, `src-tauri/src/native_panels.rs`, `tests/app-panel.test.mjs`, `tests/chrome-overlay.test.mjs`.

## Checks
- `node --test tests/app-panel.test.mjs tests/chrome-overlay.test.mjs`: 17 passed.
- Final focused Rust edge tests: 3 passed, including DPI conversion at 100/150/200%, fail-closed invalid geometry, and stale snapshot rejection.
- `corepack pnpm build`: passed.
- `cargo check --bin still-desktop`: passed before the final revision-helper extraction; the final no-bundle Tauri build compiled the helper and succeeded.
- `corepack pnpm tauri build --no-bundle`: passed. Candidate: `C:\Users\haoka\Projects\Default Project\.worktrees\still-luna-attach-edge-phase1\still-desktop\src-tauri\target\release\ver0.21-test-attach-edge-r2.exe`; 14,974,976 bytes; SHA-256 `3E098E5719DEDE0A2AEBCD26AC722CDD41184CA2B5C385941CD529598CA06A6A`.
- Full frontend suite: 101 passed, 6 failed. Failures are in pre-existing app-icon validation, canvas-height, and tray expectation tests; the picker icon failure is confirmed unchanged at the source baseline (its fixture is below the existing 24 KB limit but expects rejection).
- Full Rust suite before the final edge-helper extraction: 40 passed, 2 failed, 1 ignored. Both failures (`c1_a_maximized_first_sample_never_becomes_the_floor`, `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted`) were reproduced on a clean worktree at baseline `45410ae570c0b5a62ed9e9d867808adee299f757`.

## Handoff
- Baseline source: `45410ae570c0b5a62ed9e9d867808adee299f757`; implementation began at docs-only `8cf759f95a5dc56577171f450f64b70169824d69`.
- Live Windows GUI/compositor verification has not been performed. The candidate needs testing for right-edge crossing and return, Chrome video, Apps minimum sizing, workspace switching, resize, and monitor DPI. This experiment does not prove the DWM white stripe is fixed. Do not continue to Phase 2 until user acceptance.
