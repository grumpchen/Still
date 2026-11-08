# Task: Reviewed agent workspace controls

- Agent: Luna
- Time: 2026-11-08T17:37:41+13:00

## Done
- Added a tool-gated reversible theme preference proposal restricted to explicit light/dark requests. The review shows before/after values; completion checks the current UI state and `still-workspace-v2` before claiming the setting was saved.
- Added a selected-widget geometry tool action for explicit numeric move or resize requests. Inspection includes placement; review shows old and new geometry; validation rejects stale, fixed, locked, app-panel, no-op, unselected, malformed, or out-of-bounds targets. Execution uses the existing workspace mutation and Undo snapshot, and reports success only after persisted placement is verified.
- Extended Gemini, OpenAI and OpenCode schemas and native validation for the allow-listed actions.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/domain/assistantTools.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`
- `still-desktop/tests/assistant-tools.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm exec tsx --test tests/assistant-tools.test.mjs tests/assistant.test.mjs` — passed, 70 tests.
- Native Cargo test was not completed in this worktree; the isolated command waited on the Cargo build directory lock. The coordinator is running integrated native tests.

## Handoff
- Commits: `8fff6c8` and `7b5daf7`. No push or merge.
- Geometry intents require one `@`-selected widget plus explicit labeled values: `move ... x=... y=...` or `resize ... width=... height=...`.
