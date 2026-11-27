# Task: assistant workbench wiring

- Agent: luna_native
- Time: 2026-11-26T13:50:50+00:00 (UTC)

## Done
- Added optional `workbenchContext`, `executeWorkbench`, `directWorkbenchRequest`, and `canHandleDirectWorkbenchRequest` props to the standard AssistantPanel flow.
- Standard provider context now includes the host workbench snapshot. Nonempty `workbenchActions` are dispatched through the host callback, and the chat displays only its nonempty receipt; thrown/ambiguous failures show an error instead of the model's success claim.
- A host-recognized direct rule request runs before provider configuration checks, so supported rules can be saved without an API key. Unsupported input can fall through to the configured provider.
- Explicit tray clearing, workspace deletion, and bulk widget removal call their existing host operations directly. The last-workspace guard, locked-widget validation, and running AI Command preservation remain. Explicit individual widget removal also executes after target validation without a second confirmation; ambiguous removal asks for a target.
- Kept the experimental provider agent flow and its review behavior unchanged.

## Files
- `src/AssistantPanel.tsx`
- `src/domain/assistant.ts`
- `tests/assistant-panel.test.mjs`
- `tests/assistant-sidebar.test.mjs`
- `tests/assistant.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm exec tsx --test tests/assistant-panel.test.mjs tests/assistant-sidebar.test.mjs tests/assistant.test.mjs tests/assistant-bulk-removal.test.mjs` — 79 passed.
- `git diff --check` — passed.

## Handoff
- Host integration must supply the optional context and callbacks. `executeWorkbench` must return the shared dispatcher's actual receipt or throw a failure/clarification; no operation service was duplicated here.
- No `App.tsx` changes. This worktree did not exercise native Windows behavior.
