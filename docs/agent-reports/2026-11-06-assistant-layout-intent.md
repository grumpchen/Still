# Task: Preserve sizes in assistant arrangements

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:57:23+13:00

## Done
- Reject arrangement proposals that resize widgets when resizing was not requested.
- Recognize resize requests prefixed with an @ widget mention and test the panel preview path.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`
- `still-desktop/tests/assistant-panel.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs tests/assistant-panel.test.mjs` — 55 passed.
- Focused mocked-provider @ resize panel test — passed.
- `pnpm check` — passed.

## Handoff
- Live native/provider validation and broader action parity remain open. Existing mixed uncommitted work was preserved; no commit was made.
