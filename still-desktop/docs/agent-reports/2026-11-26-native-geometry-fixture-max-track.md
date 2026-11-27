# Task: native geometry fixture max track

- Agent: luna_native
- Time: 2026-11-26T14:47:08+00:00 (UTC)

## Done
- Retrieved the raw GitHub Actions logs for run `45840882856`, job `139981883771`.
- Both failures came from the hosted desktop's default `WM_GETMINMAXINFO` max-track limits, not from changed production sizing logic. The embedded-window fixture expected `(1200,750)` but got `(1044,750)`; the resize fixture expected `(1280,840)` but got `(1044,788)`. These are the hosted display's maximum track dimensions.
- Added test-only window procedures that raise `ptMaxTrackSize` to 4096 for the two geometry fixtures. Existing exact geometry assertions and the 1x/1.25x/1.5x/2x resize loop remain unchanged.

## Files
- `src-tauri/src/app_panel.rs`
- `src-tauri/src/native_resize.rs`

## Checks
- `git diff --check` — passed.
- Rust fixture execution was not available locally because Cargo is not installed. Windows CI must confirm both isolated fixtures now pass.

## Handoff
- The change is limited to test fixtures and removes an implicit dependence on the runner's display max-track size. Production app-panel and resize behavior is unchanged.
