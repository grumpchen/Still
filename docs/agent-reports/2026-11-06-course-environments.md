# Task: Course-linked environments

- Agent: Codex
- Time: 2026-11-06T03:28:20+13:00

## Done
- Timetable entries can link to an existing Still workspace, and their row action opens that workspace.
- Links persist across restart, invalid or stale workspace IDs are discarded, and deleting a workspace clears its timetable links. Undo still restores the previous state.
- Fixed assistant intent validation so a blank workspace named “Course Focus” is not mistaken for a request to add a Focus widget.
- Built the updated Windows executable at `D:\Still\builds\still-latest-2026-11-06\release\still-desktop.exe` (20,162,560 bytes; SHA-256 `B4529BD6EA8861CBBAC14F6995FB8D425D6B9D13FBF69C9B563FF77CAEAE6977`).

## Files
- `still-desktop/src/TimetableWidget.tsx`, `src/DashboardHome.tsx`, `src/WorkspaceCanvas.tsx`, `src/widgets.tsx`, `src/App.tsx`
- `still-desktop/src/domain/workspaces.ts`, `src/domain/assistant.ts`, `src-tauri/src/assistant_protocol.rs`, `src/localization.tsx`, `src/canvas.css`
- `still-desktop/tests/workspaces.test.mjs`, `tests/assistant.test.mjs`, `tests/e2e/dashboard-assistant.spec.ts`
- `docs/plans/2026-11-06-course-environments.md`

## Checks
- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec tsx --test tests/assistant.test.mjs tests/workspaces.test.mjs` — 49 passed.
- `pnpm exec playwright test tests/e2e/dashboard-assistant.spec.ts` — 10 passed.
- Focused Rust assistant protocol test — passed.
- `git diff --check` — passed (only existing LF/CRLF conversion warnings).
- `pnpm tauri build --no-bundle` — passed. Vite reports an existing >500 kB chunk warning; Rust reports the existing unused `set_chrome_profile` warning.

## Handoff
- This first slice links courses to Still workspaces and opens them on demand. It does not automatically switch workspaces based on class time or attach folders to a course.
- The checkout has unrelated pre-existing edits; none were reverted, staged, committed, or pushed.
- Browser-based Playwright coverage passed. The native Windows executable was built but not launched for manual desktop acceptance.
