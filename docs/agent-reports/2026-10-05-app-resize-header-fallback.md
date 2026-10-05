# Task: Add an always-accessible app resize control

- Agent: OpenCode assistant (GPT-6 Luna)
- Time: 2026-10-05T22:44:42.356+13:00 (local time)

## Done
- Added an Apps-only `↘` resize button to the widget header. It uses the existing drag-resize gesture and supports arrow-key resizing, so it remains outside the attached native app surface.
- Built a second isolated test executable, `Still-Resize-Test-2.exe`, with a separate app identifier/profile. The first test copy and existing `ver0.18.exe` were not overwritten or launched.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/docs/plans/2026-10-05-app-resize-grip-cutout.md`
- Local ignored build artifact: `Still-Resize-Test-2.exe`
- This report

## Checks
- `corepack pnpm test` — 54 passed, 0 failed.
- `corepack pnpm build` — TypeScript and Vite production build passed; confirmed the built bundle contains the new resize control.
- Tauri no-bundle release build — passed; confirmed the executable embeds the isolated test ID and title.
- `git diff --check` — passed.

## Handoff
- Test the new copy at `C:\Users\haoka\Projects\Default Project\Still-Resize-Test-2.exe`. The `↘` button in the Apps widget header should be draggable and respond to arrow keys even when the corner is covered.
- The native corner cutout remains in place; the header control is a fallback because the user's test still showed the native app covering the corner. Verify this build interactively before calling the issue fully resolved.
- Unrelated untracked agent plans/reports in the workspace were left untouched.
