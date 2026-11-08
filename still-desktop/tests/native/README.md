# Native Windows assistant acceptance

From `still-desktop`, use the installed Windows WebView2 runtime, Node, pnpm dependencies, and Rust toolchain. Close the native development preview and stop its Vite server before running the fixture. Tauri’s native dev command allowlist requires port 4318. The script refuses to use a running app at its executable path or an occupied Vite port.

```powershell
node --import tsx tests/native/assistant-reliability.mjs success
node --import tsx tests/native/assistant-reliability.mjs stale
node --import tsx tests/native/assistant-reliability.mjs timeout
node --import tsx tests/native/assistant-reliability.mjs restart
node --import tsx tests/native/assistant-reliability.mjs revoke
node --import tsx tests/native/assistant-reliability.mjs theme
node --import tsx tests/native/assistant-reliability.mjs move-widget
node --import tsx tests/native/assistant-reliability.mjs resize-widget
node --import tsx tests/native/assistant-reliability.mjs library-edit
node --import tsx tests/native/assistant-reliability.mjs library-conflict
```

Run the cases one at a time. The script builds and launches Still with a unique app identifier and WebView profile, sets up only synthetic files and grants, then attaches Playwright over a temporary loopback WebView debug port. The app starts on a blank page; the script stubs model calls before loading the assistant. File and journal operations still use native Tauri commands. The fixture refuses to submit a task unless Still reports the exact disposable Inbox.

The restart case lets the first move complete, holds the second before dispatch, kills only the named fixture, then relaunches it with the same profile and journal. It verifies that the first move appears as completed, that no remaining change runs automatically, and that the second move can complete after a fresh review. The revoke case replaces the fixture grant between launches. Rust tests cover interruption between the native mutation and its receipt.

The control cases check exact persisted values and undo. The Library cases exercise browse, search, read, and reviewed save through the Notes widget’s grant; the conflict case edits the file outside Still after the review opens and checks that approval does not overwrite it.

Artifacts remain under the Rust target's `assistant-native-fixtures/` directory and the uniquely named test app data directory for diagnosis. If necessary, set `STILL_FIXTURE_CARGO_TARGET` to a local, dedicated Cargo output directory with sufficient free space. Relaunch normal Still without the fixture config or WebView debug arguments after testing.
