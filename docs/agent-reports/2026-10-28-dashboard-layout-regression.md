# Task: Dashboard layout regression check

- Agent: Codex GPT-6
- Time: 2026-10-28T02:06:26+13:00

## Done
- Added a regression check ensuring the Dashboard routes through a dedicated fixed study page, lays out calendar, focus, notes, timetable, and Library as distinct sections, and keeps the mobile single-column layout.

## Files
- `still-desktop/tests/dashboard-home-layout.test.mjs`

## Checks
- `pnpm exec tsx --test tests/dashboard-home-layout.test.mjs` — 1 passed.
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large JavaScript chunk advisory.
- `git diff --check` — passed.
- Full `pnpm test` — 258 passed, 49 failed out of 307. The failures are across pre-existing appearance, app-panel, workspace/group, timer, and migration checks; they need separate triage.

## Handoff
- The Dashboard's current layout is distinct from floating widgets. Continue investigating the full-suite failures and verify the study workspace in the running Windows app before considering this larger goal complete.
