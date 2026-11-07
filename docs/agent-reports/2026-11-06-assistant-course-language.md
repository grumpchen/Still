# Task: Natural course auto-open commands

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T10:17:18+13:00

## Done
- Recognize common automatic-opening phrases and quoted course names for the per-course action.
- Allow an @ Timetable selection to disambiguate courses with the same name in different widgets.
- Preserve exact course matching and reject ambiguous targets.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 52 passed; `pnpm check` passed.
- Focused Playwright natural per-course action and undo — passed before the @ selection follow-up; the follow-up has domain coverage.

## Handoff
- Live native/provider validation and broader action parity remain open. Existing mixed uncommitted work was preserved; no commit was made.
