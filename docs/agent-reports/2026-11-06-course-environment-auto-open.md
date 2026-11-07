# Task: Scheduled course environment opening

- Agent: Luna
- Time: 2026-11-06T09:29:42+13:00

## Done
- Linked classes now switch to their workspace automatically while Still is open, from 10 minutes before through 15 minutes after the class start. A global setting and per-class checkbox opt out. Multiple due destination workspaces show one sorted chooser; links are revalidated before opening.
- Occurrences are deduplicated across app restarts. Nonexistent spring-forward times are skipped; repeated fall-back times resolve to the first occurrence.
- Normal and assistant workspace deletion clear timetable links in the same state transition; undo retains the original links.
- Switching only changes Still's workspace. It does not launch or control native applications.

## Files
- `still-desktop/src/domain/courseEnvironments.ts`, `src/domain/workspaces.ts`
- `still-desktop/src/App.tsx`, `src/GeneralSettings.tsx`, `src/TimetableWidget.tsx`, `src/localization.tsx`, `src/canvas.css`
- `still-desktop/tests/course-environments.test.mjs`, `tests/e2e/course-environments.spec.ts`
- `docs/agent-reports/2026-11-06-course-environment-auto-open.md`

## Checks
- `pnpm exec tsx --test tests/course-environments.test.mjs` — 5 passed.
- `pnpm exec playwright test tests/e2e/course-environments.spec.ts` — 4 passed.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk warning.
- `git diff --check` — passed with existing LF/CRLF conversion warnings.
- Native Windows build and live app acceptance were not run.

## Handoff
- No files were staged, committed, or pushed. Existing unrelated dirty work was preserved.
