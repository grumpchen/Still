# Task: AI Command bulk removal confirmation

- Agent: Codex (GPT-6.2 Sol)
- Time: 2026-11-18T22:00:00+08:00 (Asia/Shanghai; approximate)

## Done
- Bulk close/delete commands preserve locked widgets and the AI Command widget that launched the operation.
- The first AI Command run asks for confirmation and explains that future runs of this saved command will not ask again. Approval is stored locally for that workspace, widget, and prompt; changing the prompt requires confirmation again.
- Recognized “close everything” phrasing as a destructive bulk action so it reaches the confirmation flow instead of an unsupported-action error.

## Files
- `still-desktop/src/AssistantPanel.tsx`, `still-desktop/src/widgets.tsx`, `still-desktop/src/App.tsx`
- `still-desktop/src/domain/assistantBulkRemoval.ts`, `still-desktop/src/domain/assistantCommandPermissions.ts`, `still-desktop/src/domain/assistant.ts`
- Focused assistant tests

## Checks
- Focused AI Command, bulk removal, assistant and sidebar tests: 75 passed.
- `pnpm check`: passed.
- `pnpm build`: passed; existing large-chunk warning remains.
- `git diff --check`: passed.

## Handoff
- Approval is local to the app installation and scoped to one workspace, AI Command widget ID, and normalized command text. No Windows GUI run was performed.
