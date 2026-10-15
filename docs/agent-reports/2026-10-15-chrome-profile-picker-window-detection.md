# Task: Chrome Profile Picker Window Detection

- Agent: Codex
- Time: 2026-10-15T21:34:21+13:00

## Done
- Track pre-launch windows by HWND and PID, so the profile picker will not accidentally claim an older Chrome window.
- When the picker stays open, accept a newly created, unique Chrome window even if it is not foregrounded. Continue accepting a transformed picker window or the newly foregrounded selected profile.
- Keep the selected Chrome window attached to the Apps widget.

## Files
- still-desktop/src-tauri/src/app_panel.rs

## Checks
- Reproduced the old-window ambiguity in the focused profile-picker selection test, then passed it after the change.
- Full Rust suite: 87 passed, 0 failed, run serially.
- Live Chrome GUI acceptance was not available in the current UI session.

## Handoff
- Changes are committed locally and have not been pushed.
