# Task: Match widget plugin targets

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:47:39+13:00

## Done
- Resolve a named or selected widget for plugin changes and ask for clarification when multiple widgets match.
- Reject extra plugin targets and limit requests for all Notes widgets to Notes.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs tests/assistant-panel.test.mjs` — 53 passed before the all-Notes refinement.
- `pnpm exec tsx --test tests/assistant.test.mjs` — 50 passed after the refinement.
- `pnpm check` — passed.

## Handoff
- Broader assistant action parity and native/provider validation remain open. Existing mixed uncommitted changes were preserved; no commit was made.
