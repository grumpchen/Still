# Task: Dashboard agenda follow-up

- Agent: Luna
- Time: 2026-11-26T13:02:00+00:00 (UTC)

## Done
- Dashboard's Today strip now aggregates date-specific Calendar events and weekday Timetable courses across all workspaces. Course items open their linked workspace.
- Dashboard edit commits now send only newly added widgets and fields changed during the edit. Unrelated current widget state is preserved if it changes asynchronously while the editor is open.
- The launch/resume browser test seeds a prior active Study workspace and verifies that Dashboard still opens, records Study, and resumes it. It also checks a Calendar event and Timetable course appear together.

## Files
- `src/App.tsx`, `src/DashboardHome.tsx`, `src/styles.css`, `tests/e2e/dashboard-custom-layout.spec.ts`

## Checks
- `pnpm check` — passed.
- Focused Dashboard, Browser and appearance tests — 6 passed.
- Playwright Dashboard edit/cancel and startup/agenda/resume — 2 passed with Linux system Chromium.
- `git diff --check` — passed.
- Windows validation was not run.

## Handoff
- The change is on top of the Dashboard commit in `agent/luna/global-layouts`; no merge to `main` was performed.
