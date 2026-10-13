# Task: Chrome taskbar profile picker

- Agent: Codex GPT-6
- Time: 2026-10-13T13:43:47+13:00

## Done
- Confirmed the pinned Google Chrome taskbar shortcut had no arguments and Chrome's `profile.show_picker_on_startup` preference is enabled.
- Updated the pinned shortcut to pass `--new-window chrome://profile-picker/`, so launches from that shortcut explicitly request the chooser even when Chrome is already running.
- Invoked the same Chrome arguments while the existing Chrome process was running; Chrome routed the request to its existing browser session.

## Files
- Windows pinned shortcut `Google Chrome.lnk` (under the current user's taskbar pinned shortcuts).
- `docs/agent-reports/2026-10-13-chrome-taskbar-picker.md`

## Checks
- Read back the shortcut target and confirmed the new arguments were saved.
- Confirmed Chrome's profile picker on startup preference is enabled.
- Visual confirmation of the chooser was unavailable in this session.

## Handoff
- Clicking the pinned Google Chrome shortcut should now request the chooser. Restore the previous default behavior by clearing its arguments if needed.
