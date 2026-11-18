# Task: Open Files from AI Command

- Agent: Codex (GPT-6.2 Sol)
- Time: 2026-11-18T13:28:56+08:00

## Done

- Recognized “open a files” and close variants as requests for one new Files widget. Still resolves them locally when run from AI Command or sent from Assistant, including when the agent preview is enabled.
- Kept existing handling for requests to open files, folders, or saved items.

## Files

- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/assistant.test.mjs`
- `still-desktop/tests/assistant-panel.test.mjs`

## Checks

- `pnpm check` passed.
- `pnpm exec tsx --test tests/assistant.test.mjs tests/assistant-panel.test.mjs tests/ai-command-widget.test.mjs` passed all 64 tests. The regression test clicks Run command with DeepSeek selected and agent preview enabled, then checks that one Files widget action is sent to Still and no provider call is made.
- `git diff --check` passed.

## Handoff

- The regression uses a simulated desktop bridge. Other DeepSeek requests still use the existing reply parser, and the original reply body was unavailable.
