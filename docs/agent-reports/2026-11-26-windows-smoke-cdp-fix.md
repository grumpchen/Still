# Windows smoke CDP startup fix

## Finding

The fa5 runner log shows the Still main window and its WebView2 child process started, but no child had `--remote-debugging-port=9222` and Node received `ECONNREFUSED` from `127.0.0.1:9222`.

The cause is the option boundary. The smoke script set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, but that variable is not consumed by the locked Wry/Tauri versions. In Wry 0.57.0, `src/webview2/mod.rs` obtains the browser arguments from `PlatformSpecificWebViewAttributes.additional_browser_args` (lines 299–328) and passes them to `CoreWebView2EnvironmentOptions::set_additional_browser_arguments` (line 333). Tauri 2.12.1 exposes this through `tauri.conf.json`'s `app.windows[].additionalBrowserArgs`, the window/webview builders, and mutable runtime `Context.config_mut()`.

The implementation no longer relies on the unused environment variable. It sets the main window configuration before `Builder::run`, and gives Browser child webviews the same args. The argument string includes Wry's default compatibility switches (`--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`) plus the three existing background timer flags. CDP is opt-in only when `GITHUB_ACTIONS=true` and `STILL_TEST_CDP_PORT` is a numeric port >= 1024; no arbitrary browser arguments are accepted. The smoke script supplies that dedicated variable to the same candidate executable and records the opt-in in its report.

## Changes

- `automation_runtime.rs`: construct the full argument list, update the generated main-window config before startup, and gate numeric CDP ports to GitHub Actions.
- `browser_panel.rs`: pass matching arguments to embedded Browser child webviews.
- `main.rs`: generate and configure the Tauri context before running the app.
- `windows-workbench-smoke.mjs`: opt in with `STILL_TEST_CDP_PORT`; remove the ineffective WebView2 browser-args env and inaccurate isolated-profile claim.

## Checks and limits

- Static inspection against downloaded locked crate sources confirmed the API and configuration field.
- Smoke argument tests cover preservation of Wry defaults, background flags, valid port syntax, and GitHub-only gating.
- `node --check` and `git diff --check` are expected to run before handoff.
- This Linux environment has no Rust compiler and cannot launch Windows WebView2. The cause is strongly evidenced by the source and observed process flags; endpoint availability and tray-rule behavior still require the next Windows runner result.
