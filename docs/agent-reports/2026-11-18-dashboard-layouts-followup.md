# Task: Dashboard layouts workflow

- Agent: Codex
- Time: 2026-11-18T13:15:00+00:00

## Done
- Added a persisted Layouts panel to save named size arrangements, rename and duplicate saved entries, preview supported modules, choose a target workspace, append independent Calendar/Focus/Timetable widgets, and undo the copy.
- Existing Dashboard module behavior is retained; Library is called out as Dashboard-only in the copy preview.

## Files
- `src/DashboardHome.tsx`
- `src/App.tsx`
- `src/styles.css`
- `tests/e2e/dashboard-layouts.spec.ts`

## Checks
- `pnpm check` passed.
- Chromium focused tests with one worker and trace off: 2 passed (edit-only resize/cancel and save-refresh-copy-preserve-undo).
- `git diff --check` passed.

## Handoff
- Layout metadata currently persists in a dedicated localStorage key. The copy operation is exposed to Dashboard UI through App callbacks; it is not yet exported as a domain API for external AI callers. Copy currently adds the supported Calendar, Focus, and Timetable widget types; Library remains unsupported and is identified in preview. Saved dimensions are for the Dashboard modules and are not applied as canvas placements in the target workspace.
