# Task: Name-based assistant clarification

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T10:31:37+13:00

## Done
- Allow a unique widget label, with optional the, as a response to a pending widget-selection clarification; @ remains supported.
- Keep unrelated requests and attached Library contexts from automatically resuming a previous request.
- Verify the original action against the current workspace and keep the actual reply in chat.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts`

## Checks
- Focused Playwright follow-up flow — passed for course settings, @ selection, unrelated requests and a widget plugin.
- `pnpm exec tsx --test tests/assistant-panel.test.mjs` — 4 passed.
- `pnpm check` — passed.

## Handoff
- The deterministic follow-up accepts a unique exact widget label; broader free-form clarification and live provider/native validation remain open. Existing mixed uncommitted work was preserved; no commit was made.
