# Task: dashboard-calendar-phase-1

- Agent: Codex GPT-6
- Time: 2026-10-27T21:37:00+13:00

## Done
- Added a protected Dashboard workspace, initial-home migration for older workspace data, and preserved existing workspace contents.
- Added a Calendar widget with month navigation, day agenda, event categories, and locally persisted events; added Dashboard date and quick actions.
- Recorded the Library inbox/download opt-in decision: explicit reversible Downloads redirection, AI classification suggestions, and no automatic deletion.

## Files
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/domain/studyCalendar.ts`
- `still-desktop/src/CalendarWidget.tsx`
- `still-desktop/src/domain/presets.ts`
- `still-desktop/src/domain/widgetCatalog.ts`
- `still-desktop/src/widgets.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/tests/canvas.test.mjs`
- `still-desktop/tests/workspaces-relaunch-migration.test.mjs`
- `docs/plans/2026-10-27-study-platform-upgrade.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory (607.49 kB JS).
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- Phase 1 is ready to commit and push. Next is the Library workspace and explicit, reversible Still Downloads inbox setup; file classification must not delete items automatically.
