# Task: Preserve assistant widget selection

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:45:05+13:00

## Done
- Carry selected widget IDs from the assistant request through application and confirmation to both current-state intent validations.
- Added a full-app regression that selects one of two Notes widgets and verifies that only its current tab closes.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts`

## Checks
- `pnpm check` — passed.
- `pnpm exec tsx --test tests/assistant.test.mjs tests/assistant-panel.test.mjs` — 53 passed.
- Focused Playwright selected Notes test — passed; an earlier run used an incorrect assistant button locator and timed out before interaction.

## Handoff
- Live native/provider testing and broader action parity remain open. Existing mixed uncommitted work was preserved; no commit was made.
