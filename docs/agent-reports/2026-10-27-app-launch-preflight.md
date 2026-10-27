# Task: app launch preflight

- Agent: Codex GPT-6
- Time: 2026-10-27 20:47 Pacific/Auckland (UTC+13)

## Done
- Added a native preflight launch command that resolves a live attachable window before an Apps widget is created. Failed resolution stays in the picker or reports a notification without adding a widget.
- Routed installed app launches, manually selected apps, saved Apps shortcuts and Apps tray launches through preflight, then attaches the returned HWND/PID.
- Removed Chrome profile-picker window inference. Chrome app launches now use an explicit shortcut profile or Local State's last-used profile and start a new window. External Chrome URLs use the same last-used profile.
- Updated architecture notes. Existing keyboard shortcuts and widget controls were not changed.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src-tauri/src/chrome.rs`
- `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src/platform/appPanel.ts`
- `still-desktop/src/AppWindowPicker.tsx`
- `still-desktop/src/App.tsx`
- `architecture.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted the existing large-chunk advisory.
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed with one pre-existing unused-method warning.
- `git diff --check` — passed.
- No live Chrome/Douyin acceptance test was performed; the user will test the updated app.

## Handoff
- Build/install the updated Windows app and retry Chrome's user/profile flow, the Still Apps picker, and Douyin. Confirm failed launches do not leave an Apps widget behind. A timed-out launch may leave the external app process running; Still reports that it could not locate an attachable window.
