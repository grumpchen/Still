# Task: Windows workbench smoke script

- Agent: Luna (model not recorded)
- Time: 2026-11-26T13:23:07+00:00

## Done
- Added a GitHub Actions-only Windows smoke runner for a caller-supplied candidate Still executable. It records the executable SHA-256, launches it with WebView2 remote debugging on port 9222, and connects Playwright over CDP to the main `design-preview.html` webview.
- Checks rendered active Dashboard and native fullscreen status, writes a screenshot and JSON report to the requested artifact directory, invokes the embedded Browser present/navigate/close commands and verifies the WebView2 targets appear/change/disappear, then invokes minimize-to-tray and checks hidden native status plus native tick sequence and a tick callback delivered to the hidden page.
- Sets `APPDATA` and `LOCALAPPDATA` to an isolated temporary runner profile, deletes it after terminating the full process tree, bounds startup/target/tick waits, preserves raw CDP/IPC/process errors, and fails checks when the UI/CDP path is unavailable.
- Does not simulate or claim a physical tray-menu click, other-app UI, or manual GUI acceptance. Does not modify workflows or application/native source.

## Files
- `still-desktop/scripts/windows-workbench-smoke.mjs`

## Checks
- `node --check scripts/windows-workbench-smoke.mjs` — passed.
- Imported `@playwright/test` and confirmed `chromium.connectOverCDP` is available — passed.
- `git diff --check` — passed.
- Windows executable/CDP smoke — not run; this environment is Linux. The script explicitly refuses to launch outside a Windows GitHub Actions runner.

## Handoff
- CI must pass the candidate executable path and artifact directory, install frontend dependencies as usual, run `node scripts/windows-workbench-smoke.mjs --exe <candidate.exe> --artifact-dir <artifact-dir>`, then upload the report and screenshot.
- Existing `.github/workflows/windows-build.yml` path filters do not currently include `still-desktop/scripts/**`; the workflow owner should include the script path and add the smoke step/artifact upload.
