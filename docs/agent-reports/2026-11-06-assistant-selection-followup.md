# Task: Continue assistant selection clarifications

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T10:28:23+13:00

## Done
- Keep a pending widget-selection request when Still asks for a target, and resume it when the next message selects exactly one widget with @.
- Preserve the actual follow-up in the chat; clear the pending request for unrelated messages and when chat is cleared.
- Revalidate the original request against the current workspace and selection before applying it.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts`

## Checks
- `pnpm check` and focused assistant/domain tests — 57 passed.
- Focused Playwright ambiguity, selection and unrelated-request test — passed. The initial concurrent run reached a blank page; a standalone rerun passed.
- `pnpm build` — passed; existing large-chunk warning.

## Handoff
- The deterministic follow-up covers a single @ widget selection; broader conversational clarification and live provider/native testing remain open. Existing mixed uncommitted work was preserved; no commit was made.
