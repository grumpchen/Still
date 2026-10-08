# Task: Restore widget resize handle

- Agent: Codex
- Time: 2026-10-09T10:04:40+13:00 (Pacific/Auckland)

## Done
- Kept the shared bottom-right resize button and all existing drag, keyboard, minimum-size, collapsed-widget, and header behavior.
- Browser's separate Chrome HWND could paint over the shared resize button because its native clip region included the button. Browser geometry now passes the measured grip through the existing native occlusion mask, including when the widget touches the viewport edges. Apps already reserved the same grip through its native panel path.
- Source commit: `ccb86a00ef3b337645f9ad4d515d1ab1df29a18d` on `agent/codex/apps-widget-ui-cleanup`.
- Test build: `still-desktop/src-tauri/target/apps-ui-cleanup/release/ver0.21-test-apps-ui-cleanup-r3.exe` (15,140,352 bytes).
- SHA-256: `00FFB1AE69CEF05FD578D00650E82E735BE80D3AD884083D8785C83656C57892`.

## Files
- `still-desktop/src/BrowserWidget.tsx`
- `still-desktop/src/domain/chromeOverlay.ts`
- `still-desktop/tests/chrome-overlay.test.mjs`
- `still-desktop/tests/widget-resize-handle.test.mjs`

## Checks
- Focused frontend resize/header/native panel tests: 25 passed.
- `corepack pnpm check`: passed.
- `corepack pnpm build`: passed.
- `cargo check --manifest-path src-tauri/Cargo.toml --offline`: passed.
- Focused native Chrome clipping-region test and Apps live-window fixture: both passed.
- `corepack pnpm tauri build --no-bundle`: passed.
- Full frontend suite: 119 passed, 6 failed. The failures are the app-icon byte bound test, canvas-height bound test, and four inline tray tests.
- Full Rust suite: 46 passed, 2 failed, 1 ignored. Failures are `app_panel::tests::c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted` and `app_panel::tests::c1_a_maximized_first_sample_never_becomes_the_floor`; the real Chrome GUI integration test is ignored by default.
- `git diff --check`: passed.
- No interactive Windows UI verification was performed; the test executable was not launched.

## Handoff
- READY TO TEST. Please verify corner resizing on Apps, Browser, Notes, and an expanded Group, including at viewport edges. The Browser fix is limited to reserving its existing DOM grip in the native Chrome clip; it does not change attachment, Groups, or tray behavior. No merge or push was performed.
