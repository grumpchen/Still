# Task: Reject stale assistant edits

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:38:24+13:00

## Done
- Compare the fields a provider-generated widget edit would replace against the current workspace before applying or confirming it.
- Detect changed note content, active document, tags and other edited fields without rejecting unrelated widget movement.
- Added focused coverage for changed content, selected tab, tags and movement.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs tests/assistant-panel.test.mjs` — 52 passed.
- `pnpm check` — passed.

## Handoff
- Live native/provider testing and broader action parity remain open. Existing mixed uncommitted work was preserved; no commit was made.
