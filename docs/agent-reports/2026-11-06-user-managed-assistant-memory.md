# Task: User-managed assistant memory

- Agent: Luna
- Time: 2026-11-06T15:14:37+13:00

## Done
- Added local, user-managed assistant memory shared across workspaces, with explicit add, view, delete, and clear controls.
- Added the bounded memory as reference background to regular assistant context; left the Library names-only context isolated.
- Storage failures leave the visible list unchanged. Entries beyond the 100 item and 1,000 character limits are rejected with feedback; existing entries are not truncated or evicted.
- Settings explain that memories are sent to the selected provider with AI requests, except Library names-only requests.

## Files
- `still-desktop/src/domain/assistantMemory.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/assistant.css`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/assistant-memory.test.mjs`
- `still-desktop/tests/assistant-panel.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant-memory.test.mjs tests/assistant-panel.test.mjs` — 9 passed.
- `pnpm check` — passed.

## Handoff
- Changes are uncommitted in the shared checkout; the worktree already contains unrelated dirty files, so no commit was created.
