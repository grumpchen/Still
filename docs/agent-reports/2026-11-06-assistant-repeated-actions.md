# Task: Guard repeated assistant actions

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:33:42+13:00

## Done
- Reject repeated action types in direct requests before applying a provider response, except note-document creation, which uses one action per requested document.
- Added regression cases for excess widget creation and an extra visibility change.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 49 passed.
- `pnpm check` — passed.

## Handoff
- Broader action parity and live native/provider validation remain open. Existing mixed uncommitted changes were preserved; no commit was made.
