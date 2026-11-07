# Task: Safe workspace action tool foundation

- Agent: Codex
- Time: 2026-11-06T16:59:37+13:00

## Done
- Added a separate, default-off provider gate for `propose_workspace_action`; existing `add_widget` Notes tool schema and gate remain unchanged.
- Added strict one-action schemas and parsing for minimize/restore, timer start/control, sidebar/Apps bar visibility, and one Notes document creation. Other actions and extra fields fail closed.
- Added registry preparation and one-shot approval execution with UI-injected domain and intent validation, exact proposal binding, revision rechecks, and real executor receipts.
- New tool is not yet exposed by the provider UI adapter; the safe-action flag remains false unless a caller explicitly enables it after wiring review/resume.

## Files
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`
- `still-desktop/src-tauri/src/assistant.rs` (passes the separate opt-in flag to strict response parsing)
- `still-desktop/src/domain/assistantTools.ts`
- `still-desktop/tests/assistant-tools.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant-tools.test.mjs` — 9 passed, including required nullable initial note text coverage.
- `pnpm check` — passed.
- `cargo test assistant_agent_protocol` — 14 passed using the existing isolated Cargo target `still-desktop/src-tauri/target-agent-tool-review`.

## Handoff
- The frontend must add dispatch and review/resume handling for `propose_workspace_action`, pass the original prompt and selected IDs into `validateIntent` and the existing `act` executor, and explicitly set `enable_safe_workspace_action_tool` only when that handling is active.
- Existing shared checkout has extensive dirty work; no commit was created.
