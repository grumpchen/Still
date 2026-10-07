# Task: Native white stripe artifact

- Agent: Codex (GPT-6)
- Time: 2026-10-07T18:03:00+13:00 (Pacific/Auckland)

## Done
- Traced the white stripe to a native app child window moving across the parent HWND's `SetWindowRgn` clipping boundary. The native event path previously refreshed only Still or managed top-level window movement; its unchanged-geometry fast path skipped resetting the parent region after clipped child movement.
- Added a boundary check for visible child HWNDs belonging to a managed app. When a child crosses the clipped region, Still reapplies the existing parent region to clear compositor residue. Unclipped children and normal workspace geometry updates do not take this path.
- Built a separate test executable without overwriting prior builds.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `docs/agent-reports/2026-10-07-native-white-stripe-fix.md`
- Test executable: `ver0.21-test-white-stripe.exe`

## Checks
- Native Windows tests: 30 passed, 0 failed, 1 opt-in real Chrome smoke test ignored.
- Frontend tests: 56 passed, 0 failed.
- TypeScript and Vite production build passed.
- Tauri Windows release build passed.
- Changed-file whitespace check passed. Repository-wide `git diff --check` still reports an unrelated pre-existing trailing blank line in `AGENTS.md`.
- Real Chrome GUI acceptance remains for the user; the native fixture verifies region-preserving reset and child-boundary detection, not the DWM artifact itself.

## Handoff
- Test the copied executable by scrolling the workspace vertically/horizontally and overlapping widgets around an attached Chrome/app panel. Check that the white stripe clears and the interaction remains smooth.
- The shared checkout already contained unrelated uncommitted resize/minimum-size work in the same Rust file. Those changes were preserved and are intentionally excluded from this task's commit.
