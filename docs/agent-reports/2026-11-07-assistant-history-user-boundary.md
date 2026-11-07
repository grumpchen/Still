# Task: Preserve a user turn at the start of provider history

- Agent: Codex
- Time: 2026-11-07T17:24:00+13:00

## Done

- Reproduced the agent history rejection with a chat whose retained window began with an assistant reply.
- Trimmed orphaned replies from the request copy while preserving the saved and visible transcript.

## Files

- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`

## Checks

- The regression reproduced before the fix. All 55 assistant domain tests and the focused ChatGPT plan timer panel test passed after the fix.
- Typecheck and production build passed. The live development server served the updated module.

## Handoff

- Changes remain local in the shared worktree. Checks used synthetic chat history.
