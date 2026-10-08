# Task: tray-native-resize

- Agent: tray_resize_luna_finish, GPT-6 Luna High
- Time: 2026-10-09T10:56:43+13:00 (Pacific/Auckland)

## Done
- Completed the permanent compact tray and explicit saved-copy, group-collection, and Trash flows; added the native resize guard for attached Apps and Chrome windows.
- Built the current source at `2833de229cf50691ac6cfeb02c91eddf314b4677` as `src-tauri/target/tray-native-resize/release/ver0.21-test-tray-native-resize-r2.exe` (15,187,968 bytes). SHA-256: `82FF6471A2B2BEE18C68DDE0D3CC807E24257A8983E2973352A87B8EBFCAA31C`.
- Preserved the earlier `ver0.21-test-tray-native-resize.exe` candidate (SHA-256 `BAF176D7424489BB96144B6136F907089631B31A270C9721C742C1FB46B80132`).
- Ready to test. No Still candidate was launched; no merge or push was performed.

## Files
- Tray UI and interactions: `src/App.tsx`, `src/WorkspaceCanvas.tsx`, `src/PresetTray.tsx`, `src/GroupTray.tsx`, `src/TrayEditor.tsx`, `src/domain/trayActions.ts`, `src/domain/trayDrop.ts`, `src/canvas.css`, `src/widgets.tsx`.
- Native resize guard and managed window wiring: `src-tauri/src/native_resize.rs`, `src-tauri/src/app_panel.rs`, `src-tauri/src/chrome_overlay.rs`, `src-tauri/src/main.rs`.
- Focused tray regression tests: `tests/group-tray.test.mjs`, `tests/inlineTray.test.mjs`, `tests/tray-cleanup.test.mjs`, `tests/trayDrop.test.mjs`, `tests/workspace-controls.test.mjs`.
- Build and verification logs are kept in ignored `src-tauri/target/tray-native-resize/verification/`.

## Checks
- Focused tray frontend regression: 65 passed, 0 failed (`focused-tray-tests.txt`).
- TypeScript check: `corepack pnpm check` passed.
- Full frontend suite: 124 passed, 2 known baseline failures out of 126. Failures are selected app icon bytes and the 150% canvas-height expectation (`full-frontend-tests.txt`).
- Full native suite: 47 passed, 2 known baseline failures, 1 ignored real Chrome GUI smoke test (`full-native-tests.txt`). The failures are `c1_a_maximized_first_sample_never_becomes_the_floor` and `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted`.
- Native resize guard fixture passed. It covers blocked native edge hit-testing, programmatic physical sizing at 100/125/150/200%, original style restoration, foreground preservation, and fixed-size windows. The Apps native fixture also passed, covering guard/restore, clipping and resize-grip behavior, and leaving the window alive (`native-resize-tests.txt`, `full-native-tests.txt`).
- `corepack pnpm tauri build --no-bundle --config src-tauri/target/tray-native-resize/tauri-test-config.json` passed. This ran the production `pnpm build` from current source and completed the Windows release build.
- `cargo check` passed (`native-check.txt`).
- The full frontend and native suites retain the two baseline failures above; no unrelated fixes were made.

## Handoff
- Live Windows acceptance is still needed for tray drop/cancel/delete and group-confirmation flows, attached Apps detach/release behavior, and Still's corner resizing across Windows display scales. The hidden Win32 fixture covers native edge hit testing and programmatic sizing; it does not establish live Chrome/custom-app appearance.
- Chrome/custom-app white residue and app-specific style rewrites remain unproven. No clipping or movement redesign was included.
- Manual acceptance should confirm Trash cancellation/outside drops do not delete, deleting a card keeps its saved collection, collected library entries cannot be deleted, Apps release without closing the application, and native edge drags do not resize managed windows.
