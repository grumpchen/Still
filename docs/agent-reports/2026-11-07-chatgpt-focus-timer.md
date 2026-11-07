# Task: ChatGPT plan Focus timer

- Agent: Codex
- Time: 2026-11-07T17:18:15+13:00

## Done

- Send direct timer commands through Still’s existing workspace action path when ChatGPT plan is selected.
- Ask which timer to use when there are multiple candidates. Keep the original duration when the user answers with a timer name or a unique Focus selection.

## Files

- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`

## Checks

- 67 assistant domain and panel tests passed, including the two-message Focus request with mocked ChatGPT plan IPC.
- Typecheck and production build passed.

## Handoff

- The fix is in the existing shared worktree. The timer test used a synthetic workspace and did not use the connected account.
