# Task: Keep collected Apps windows hidden

- Agent: Luna implementation agent
- Time: 2026-10-09 Pacific/Auckland

## Done
- Started from baseline `7f7deec3432fdb805d5c02f9b058fc53f8773fdd` on isolated branch `agent/luna/group-native-visibility`.
- Apps collection now marks the exact native window as collected, verifies and enforces its hidden state before accepting later presentation snapshots or refreshing native placement, and preserves the presentation revision during collection. Explicit reopen clears collection ownership and waits for a fresh visible presentation; cancellation restores prior visibility. No Browser, Group UI, tray, clipping or containment behavior was changed.
- The Win32 fixture regression reproduces the stale cached-visibility failure mode: with the previous `shown`-cache check, an out-of-band `SW_SHOW` after collection remained visible; the new `IsWindowVisible` guard hides the fixture HWND again. This is a controlled native decision-path regression, not a live Chrome/Tauri command test.
- Source commit: `b2e86fbf7d70287a66dcdce0ce56d8b2e445f09d`.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/tests/group-tray.test.mjs`
- `still-desktop/tests/native-group-drag.test.mjs`

## Checks
- Win32 native fixture: collected → late show → hidden again → explicit restore of the same HWND/PID passed (1/1).
- Win32 cancellation fixture: prior visibility restored and window retained passed (1/1).
- Focused frontend tests (`native-group-drag`, `group-tray`, `app-panel`): 37 passed, 0 failed.
- TypeScript check (`pnpm check`) passed; production frontend build (`pnpm build`) passed.
- Full frontend suite: 137 passed, 2 failed. The failures are existing assertions for saved app-icon byte bounding and the 150%-viewport canvas-height bound; both are outside this change.
- Full Rust suite from this task state: 50 passed, 2 failed, 1 ignored. The two failures are the pre-existing `c1_a_maximized_first_sample_never_becomes_the_floor` and `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted` resize-minimum tests; an existing live-Chrome GUI test is ignored.
- Windows Tauri release build (`pnpm tauri build --no-bundle`) passed. Cargo-generated permission TOMLs were restored; `git diff --check` passed.

## Handoff
- Test executable: `still-desktop/src-tauri/target/group-native-visibility/release/ver0.21-test-group-native-visibility.exe`
- SHA-256: `865149B34453FE7CDE792730E4A452C3E7451D2BDC4DD6A30B8878863430B563`
- The executable was built but not launched. Manual Windows Chrome acceptance is still required to verify actual Tauri collection/reopen behavior, process survival, and taskbar visibility. A dead or uncontrollable HWND returns an actionable reattach error. No merge or push performed.
