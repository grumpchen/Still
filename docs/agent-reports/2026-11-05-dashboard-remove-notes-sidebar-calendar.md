# Task: Simplify Dashboard and sidebar

- Agent: opencode (gpt-6.1-sol)
- Time: 2026-11-05T20:27:04+13:00

## Done
- Removed the Notes section from the Dashboard render without deleting its stored note data or changing Notes/Library functionality.
- Removed Add to calendar from the sidebar's study tools. Kept the Dashboard Add to calendar and + Event actions.
- Reflowed the Dashboard into calendar/focus and timetable/library rows, with no empty Notes grid area on desktop or mobile.

## Files
- still-desktop/src/DashboardHome.tsx
- still-desktop/src/App.tsx
- still-desktop/src/styles.css
- still-desktop/tests/dashboard-home-layout.test.mjs
- still-desktop/tests/e2e/dashboard-simplification.spec.ts
- docs/agent-reports/2026-11-05-dashboard-remove-notes-sidebar-calendar.md

## Checks
- Added browser regression before implementation; it failed because Notes was still visible.
- All 5 Playwright/Edge tests passed, including absence of Dashboard Notes/sidebar shortcut, preservation of stored Notes data and Dashboard calendar action, desktop/narrow layout and existing glass styling checks.
- TypeScript tsc --noEmit passed.
- Updated Dashboard fixed-layout regression passed.
- git diff --check passed with LF/CRLF warnings.
- Fresh native capture confirms the Dashboard has Calendar, Focus, Timetable and Library only, with foggy glass retained: C:/Users/haoka/AppData/Local/hermes/profiles/opencode/cache/images/computer_use_be596c9876bf41dab77c3d319a73dfc4.png.
- Full frontend suite not repeated; prior report documents baseline failures.

## Handoff
- Live development hot-reloaded and remains running.
- Existing unrelated edits, logs and planning documents preserved.
- No commit, push or merge.
