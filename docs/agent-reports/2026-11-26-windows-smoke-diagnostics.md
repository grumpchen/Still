# Task: Windows smoke diagnostics

- Agent: Luna (model not recorded)
- Time: 2026-11-26T13:52:35+00:00

## Done
- Enhanced the Windows smoke failure report with process-tree diagnostics: candidate process and descendants, executable path, process names/parent IDs, main window handle/title, and Boolean checks for remote-debugging and WebView2 user-data switches without recording complete command lines or environment values.
- Added recursive `fetch` error-cause reporting (including Node system error code/message), bounded/redacted stdout/stderr tails, and a compact JSON diagnostic summary in CI logs.
- Stopped overriding `APPDATA` and `LOCALAPPDATA`; the GitHub runner's fresh profile remains intact, while `WEBVIEW2_USER_DATA_FOLDER` points to a temporary per-run folder deleted after process-tree cleanup.
- Investigated Tauri/Wry startup from the locked 2.12.1 / 0.57.0 source and Microsoft Learn's WebView2 flag/settings documentation; notes are in the handoff below.

## Files
- `still-desktop/scripts/windows-workbench-smoke.mjs`

## Checks
- `node --check scripts/windows-workbench-smoke.mjs` — passed.
- Imported `@playwright/test` and confirmed `chromium.connectOverCDP` is available — passed.
- `git diff --check` — passed.
- Windows runner failure reproduction — not run in this Linux environment. The updated CI diagnostic output is required to determine whether the app process/webview exists and whether the browser process received the requested debugging switch.

## Handoff
- The earlier log only establishes that Node `fetch()` could not connect to `127.0.0.1:9222`; it lacks the previous report's process-tree details, so the root cause remains unconfirmed.
- The Wry 0.57.0 WebView2 implementation passes `PlatformSpecificWebViewAttributes.additional_browser_args` to `CoreWebView2EnvironmentOptions::set_additional_browser_arguments` (`src/webview2/mod.rs`, around lines 299–333). The Still automation module sets `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` before Tauri Builder startup; the next runner report checks the actual WebView2 process command line for the port switch.
- The release Cargo features do not include Tauri's `devtools` feature. Wry's `WebViewAttributes::default()` sets DevTools false when `debug_assertions` are off (`src/lib.rs`, around line 874). Microsoft Learn's WebView2 feature-flags page describes `remote-debugging-port` as enabling HTTP remote debugging; the `AreDevToolsEnabled` setting documentation describes the F12/context-menu DevTools window. The source/docs reviewed do not establish that this setting suppresses the remote debugging endpoint, so this is recorded as a diagnostic possibility, not a confirmed cause.
- The workflow owner should inspect `process.windows`, `lastProbeError` including its nested cause code, and the actual remote-port switch flag in the next JSON artifact before choosing a native or CI change.
