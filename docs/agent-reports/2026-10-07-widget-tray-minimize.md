# Task: widget_tray_minimize_v021_r3

- Agent: Codex (GPT-6; OC implementation stalled before producing the remaining changes)
- Time: 2026-10-07T13:33:15+13:00

## Done
- Completed the tray follow-up: disclosures remain inline in a single rounded tray row, Apps shortcuts retain validated icons, and the `+` control remains available.
- Added persisted per-widget minimization. Minimized instances remain mounted, movable within workspace bounds, restore on double-click at their new position, and do not modify saved tray/group copies. Native Apps/Chrome surfaces are marked obscured while minimized.
- Anchored the workspace overview map to the visible canvas viewport and update its viewport marker during scroll without forcing widget rerenders.
- Fixed Chrome horizontal-scroll alignment by using its viewport-relative DOM rectangle once (removing the extra scroll offset) and updating native bounds during scroll. Partial intersections stay visible and scrolling alone no longer hides Chrome.
- Corrected saved Apps icon handling to accept only validated PNG data URLs or bounded PNG bytes, with a safe fallback.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`, `still-desktop/src/canvas.css` — minimization, movement/restoration, and fixed overview map.
- `still-desktop/src/domain/workspaces.ts`, `still-desktop/src/App.tsx`, `still-desktop/src/domain/appPicker.ts` — persisted widget state and validated app icon flow.
- `still-desktop/src/BrowserWidget.tsx`, `still-desktop/src/platform/canvasScroll.ts`, `still-desktop/src/domain/chromeOverlay.ts` — Chrome alignment and scroll synchronization.
- `still-desktop/tests/` — minimization, tray, app-picker, scroll and overlay regressions.

## Checks
- `corepack pnpm test` — 103 passed, 0 failed.
- `corepack pnpm check` — passed.
- `corepack pnpm build` — passed.
- `git diff --check` — passed.
- `corepack pnpm tauri build --no-bundle` — passed; rebuilt the isolated test executable `still-desktop/src-tauri/target/release/ver0.21-test-widget-tray-minimize-r3.exe`.
- Native Chrome alignment and interactive minimize/restore still require the user's Windows acceptance test; the executable was not launched.

## Handoff
- Branch: `agent/opencode/widget-tray-minimize`; baseline: `c3ebd7c579471bf6c67c85f555da11b0daf3a2e8`.
- Candidate: `still-desktop/src-tauri/target/release/ver0.21-test-widget-tray-minimize-r3.exe`.
- No merge, push, or release acceptance performed. Ready for user testing; report any remaining visual issue as a fix iteration without overwriting this candidate.
