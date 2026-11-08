# Native Windows assistant acceptance

From `still-desktop`, use the installed Windows WebView2 runtime, Node, pnpm dependencies, and Rust toolchain. The fixture chooses a free loopback Vite port and a separate free WebView CDP port. That exact Vite port is authorized only for the fixture's debug process; the existing 4318 rule and production trust boundary remain unchanged. It uses a unique app identifier and WebView profile. If the normal development Still app is open, set `STILL_FIXTURE_CARGO_TARGET` to an isolated Cargo target directory so the fixture builds a separate executable instead of colliding with the open app. The script refuses to use a running app at its exact executable path.

```powershell
$env:STILL_FIXTURE_CARGO_TARGET = "D:\Still\native-fixture-target"
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
node --import tsx tests/native/assistant-reliability.mjs library-create
node --import tsx tests/native/assistant-reliability.mjs library-folder-create
node --import tsx tests/native/assistant-reliability.mjs pdf-highlights
node --import tsx tests/native/assistant-reliability.mjs files-viewers
```

Unset `STILL_FIXTURE_CARGO_TARGET` afterward if you want later runs to use the normal `src-tauri/target` directory. Fixture workspaces, files, grants, and WebView profiles remain isolated under the chosen Cargo target and the fixture app-data directory.

Run the cases one at a time. The script builds and launches Still with a unique app identifier and WebView profile, sets up only synthetic files and grants, then attaches Playwright over a temporary loopback WebView debug port. The app starts on a blank page; the script stubs model calls before loading the assistant. File and journal operations still use native Tauri commands. The fixture refuses to submit a task unless Still reports the exact disposable Inbox.

The restart case lets the first move complete, holds the second before dispatch, kills only the named fixture, then relaunches it with the same profile and journal. It verifies that the first move appears as completed, that no remaining change runs automatically, and that the second move can complete after a fresh review. The revoke case replaces the fixture grant between launches. Rust tests cover interruption between the native mutation and its receipt.

The PDF case opens a synthetic text PDF from the fixture Notes Library through the real native Files grant, invokes the selected ChatGPT provider stub, checks that only extracted PDF text is shared, applies and clears local overlays, and verifies the source PDF hash is unchanged. It also detects signed/decimal text values, Ctrl-selects two numbers, performs a right-hold radial addition, creates a Calculation widget, reloads Still, and verifies the persisted result without modifying the source PDF.

The Files viewer case opens a synthetic same-folder Office lock file from the Files widget, verifies Still offers the matching document through Windows' default app without opening the lock file, then checks the default-app and other-app options for a regular DOCX file. The DOCX preview fallback explains the available viewer choices.

The control cases check exact persisted values and undo. The Library cases exercise browse, search, read, and reviewed save through the Notes widget’s grant; the conflict case edits the file outside Still after the review opens and checks that approval does not overwrite it. The `library-folder-create` case performs two successive approvals: first create a folder, then create a Markdown note inside it. It checks both items are absent before their respective approvals and verifies each native receipt is sent into the next provider turn.

Artifacts remain under the Rust target's `assistant-native-fixtures/` directory and the uniquely named test app data directory for diagnosis. If necessary, set `STILL_FIXTURE_CARGO_TARGET` to a local, dedicated Cargo output directory with sufficient free space. Relaunch normal Still without the fixture config or WebView debug arguments after testing.
