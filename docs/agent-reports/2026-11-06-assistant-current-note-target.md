# Task: Validate the current note target

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:34:49+13:00

## Done
- Validate a requested note-tab close against the same resolved widget and document as the normal close action, including the active tab and selected widget.
- Added regression cases for an inactive tab and ambiguous Notes widgets.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 49 passed.
- `pnpm check` — passed.

## Handoff
- Live native/provider behavior and broader action parity remain to be verified. Existing mixed uncommitted work was preserved; no commit was made.
