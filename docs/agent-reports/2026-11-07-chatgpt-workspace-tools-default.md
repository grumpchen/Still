# Task: Enable ChatGPT workspace tools by default

- Agent: Codex
- Time: 2026-11-07, Pacific/Auckland

## Done

- Enabled the existing reviewed workspace-action tool by default for ChatGPT plan users, respecting an explicit disabled preference.

## Files

- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`

## Checks

- Nine assistant panel tests passed, including a mocked ChatGPT tool call, review and execution.
- Typecheck and production build passed.

## Handoff

- The tool supports a limited set of actions. General Still action coverage remains unfinished.
