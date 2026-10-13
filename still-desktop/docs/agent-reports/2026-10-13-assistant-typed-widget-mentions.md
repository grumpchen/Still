# Task: typed assistant widget mentions

- Agent: Codex
- Time: 2026-10-13 23:37 NZDT (UTC+13)

## Done
- Still AI recognizes exact, unambiguous `@Widget` names typed in a message as widget selections and shows them as chips.
- Generic type mentions stay unresolved when multiple widgets of that type exist; the user can choose the intended instance from the picker.
- A single screenshot-capable widget can still be visually shared while another selected widget supplies editable content.
- Root cause: the edit safety check used only picker selections and ignored typed widget mentions.

## Files
- `src/AssistantPanel.tsx`, `src/domain/assistantMentions.ts`
- `tests/assistant-mentions.test.mjs`, `tests/assistant-panel.test.mjs`

## Checks
- `node --test tests/assistant-mentions.test.mjs tests/assistant-panel.test.mjs` — 3 passed.
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.

## Handoff
- Reload Still to use typed `@` names in the assistant.
