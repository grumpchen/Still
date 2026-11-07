# Task: Preserve other note tags

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:36:00+13:00

## Done
- Distinguish removing a named tag from clearing all tags, preserving unrelated tags.
- Added a regression covering a note with multiple tags and an explicit clear-all request.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 49 passed.
- `pnpm check` — passed.

## Handoff
- Broader assistant action parity and live native/provider validation remain open. Existing mixed uncommitted changes were preserved; no commit was made.
