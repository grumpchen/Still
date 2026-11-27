# Task: Windows candidate smoke integration

- Agent: Codex (coordinator)
- Time: 2026-11-26T13:29:00+00:00

## Done
- Integrated Luna's real Windows executable/CDP smoke runner and added an Actions step against the freshly built candidate executable.
- Added a dedicated smoke evidence artifact; a failing smoke test keeps the job failed while the binary and its SHA-256 remain available.
- Fixed the Tauri event callback fixture to inspect `event.payload`, waited for Dashboard readiness/fullscreen, and explicitly isolated the WebView2 user-data folder.

## Files
- `.github/workflows/windows-build.yml`
- `still-desktop/scripts/windows-workbench-smoke.mjs`

## Checks
- `node --check still-desktop/scripts/windows-workbench-smoke.mjs`: passed.
- Previous candidate `872892e` on Windows Actions run `45826942233`: 141 Rust tests passed, 2 desktop-geometry fixtures filtered, release build and executable upload passed. Frontend suite at that commit: 480/515 passed, 35 known baseline failures; overall run failed as expected.
- Real executable smoke: pending on Windows Actions; not runnable on the Linux cloud machine.

## Handoff
- Smoke tests native Dashboard fullscreen, Browser creation/navigation/close, and native tick callbacks delivered to a hidden-to-tray renderer.
- These checks do not establish manual tray menu interaction, third-party application attachment, or desktop responsiveness.
