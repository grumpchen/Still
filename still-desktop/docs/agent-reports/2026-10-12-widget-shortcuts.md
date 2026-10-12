# Workspace shortcuts and widget plugin settings

Implemented on `agent/codex/widget-shortcuts` from `05c86485dcd6b26448a78f4bfaebc439e0faa739`.

## Changes

- Added exact Ctrl+M handling to toggle the workspace overview map. The existing Windows hook forwards it from Still and managed native app/browser windows; repeated keydown is suppressed and text-editing contexts are excluded.
- Added Ctrl+Shift+right-click on an open workspace card to minimize it. Other right-clicks and left-clicks retain their existing behavior.
- Moved the keyboard-shortcut entry from Appearance to General Settings and listed both new shortcuts there.
- Added Color Tag to the built-in widget-plugin catalog and rendered widget-plugin sections from that catalog in Plugins settings. Current sections include Color Tag, Widget Relaunch, Screenshot, and Clock Timer; each retains its existing settings behavior. Sidebar plugins remain separate and have no tag-color scope controls.
- Added rendered React tests for map toggling, the native-forwarded toggle event, minimize gesture filtering, and plugin settings coverage.

## Verification

- `pnpm check` — passed.
- `node --test tests/settings-dialog.test.mjs tests/widget-relaunch.test.mjs` — 19 passed.
- `pnpm test` — 216 passed.
- `pnpm build` — passed.
- `cargo test -- --test-threads=1` — 61 passed, 1 ignored (real Chrome integration test).
- An initial parallel `cargo test` had one unrelated Apps sizing test fail; that test passed on its own and the full serialized Rust suite passed.
- `git diff --check` — passed, with a line-ending normalization warning for an existing test file.

The Windows GUI was not launched for manual interaction testing. The real Chrome integration test was intentionally ignored by the suite. No release executable was built, and nothing was pushed or merged.
