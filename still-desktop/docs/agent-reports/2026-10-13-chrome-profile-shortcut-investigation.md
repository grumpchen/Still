# Task: Chrome profile shortcut investigation

- Agent: Codex
- Time: 2026-10-13 09:39 NZDT

## Done
- Traced the Apps Installed Apps catalog to `app_picker.rs::installed_shortcuts`: it scans the per-user and all-users Start Menu only.
- On this PC, the Start Menu contains a generic `Google Chrome` shortcut with no profile arguments. The `grump - Chrome` shortcut is on the Desktop and has `--profile-directory="Default"`; it is therefore omitted from the Installed Apps picker.
- The native `.lnk` launch path reads and passes shortcut arguments, so selecting that Desktop shortcut via Apps → Choose app should retain the requested Chrome profile argument.
- A separate possible failure remains if a profile window is already open: Still only discovers a newly created HWND after launch. This was not verified as the user's failing route.
- No application code changed.

## Files
- `src-tauri/src/app_picker.rs` (investigated)
- `src-tauri/src/app_panel.rs` (investigated)

## Checks
- Inspected the app picker, `.lnk` argument extraction, and Apps launch flow.
- Enumerated local Chrome shortcuts: confirmed `Google Chrome` is under Start Menu and `grump - Chrome` is on Desktop with a profile argument.
- Reproduced the discovery boundary from the configured shortcut roots; the profile shortcut is outside the roots used by the Installed Apps picker.
- Automated tests not run; this was a read-only investigation with no code changes.

## Handoff
- Workaround: in an Apps widget, use **Choose app…** and select the Desktop `grump - Chrome` shortcut; its profile argument is preserved by Still's `.lnk` launcher. If that path still fails, the next investigation should trace an already-running Chrome profile window through the native app-window discovery loop.
- The name “Stephen Chen” may be a Chrome account display name rather than another Windows shortcut; this investigation did not inspect or infer Google account identities.
