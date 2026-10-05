# Task: Build isolated resize-fix test app

- Agent: OpenCode assistant (GPT-6 Luna)
- Time: 2026-10-05T22:21:15.245+13:00 (local time)

## Done
- Built a no-installer Tauri release executable from the resize-fix branch using an overlay config with identifier `nz.personal.still.resize-test` and window title `Still · Resize Test`.
- Copied it to the project root as `Still-Resize-Test.exe`. The original `ver0.18.exe` was not changed.
- Confirmed the test identifier/title are embedded in the executable. Did not launch it.

## Files
- Local ignored build artifact: `Still-Resize-Test.exe`
- Temporary build config: `C:\Users\haoka\AppData\Local\Temp\opencode\still-resize-test.conf.json`
- This report

## Checks
- Tauri no-bundle release build — passed.
- Executable metadata reports product version 0.18.0; embedded test identifier and title checks passed.
- Confirmed `.exe` is ignored by Git; source working tree remains clean apart from this report.

## Handoff
- Launch `C:\Users\haoka\Projects\Default Project\Still-Resize-Test.exe` to test alongside the existing Still window. Its app identifier gives it a separate Tauri data/profile directory, so it starts with separate local state.
- The existing Still instance already owns its attached Codex/ChatGPT window. To test without disturbing it, attach a second Codex/ChatGPT window in the resize-test instance.
- This test executable is unsigned and was not interactively smoke-tested.
