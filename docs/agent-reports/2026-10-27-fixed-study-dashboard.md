# Task: fixed study Dashboard

- Agent: Codex
- Time: 2026-10-27T23:51:52+13:00

## Done
- Replaced the Dashboard's ordinary movable widget canvas with a fixed, responsive study-home composition for Calendar, Focus, Notes, and Timetable.
- Embedded the Library Files view in the Dashboard and retained the full Library workspace as a separate destination.
- Kept module content and calendar/timer/note data connected to existing workspace state; Dashboard timers pause while another workspace is active.
- Added migration to restore any missing fixed modules and make them visible after legacy minimized states.
- Prevented normal and AI widget operations from adding, removing, minimizing, or rearranging fixed Dashboard modules; protected built-in Dashboard and Library from AI deletion.
- Updated the study platform plan to reflect the bespoke Dashboard layout.

## Files
- `still-desktop/src/DashboardHome.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/styles.css`
- `docs/plans/2026-10-27-study-platform-upgrade.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-bundle advisory.
- `git diff --check` — passed.
- Native Windows interaction was not run in this stage.

## Handoff
- The Dashboard shares the Library Files widget's existing native folder grant. AI filing from the Dashboard still requires the same explicit review and move confirmation.
- The full Library remains available from the Dashboard button and workspace sidebar.
