# Task: Add widget confirmation loop foundation

- Agent: Codex
- Time: 2026-11-06T16:42:46+13:00

## Done
- Added an ephemeral loop pause/resume contract for confirmation-gated tool calls. Resume appends the supplied real execution receipt and continues the provider loop.
- Added a typed `add_widget` proposal limited to one Notes widget. Preparation validates the inspected revision; execution is separate, one-shot, bound to the exact in-memory proposal object, rechecks state and validation, and returns only the executor's receipt.
- Extended the Rust provider protocol with a default-off `enable_add_widget_tool` flag, strict Notes-only schema and call validation, and matching receipt validation. Existing callers still advertise and accept only read-only inspection unless they explicitly opt in.
- This is a foundation only. The AssistantPanel/provider adapter still needs to wire the pause state to a human review UI before enabling the opt-in flag.

## Files
- `still-desktop/src/domain/agentLoop.ts`
- `still-desktop/src/domain/assistantTools.ts`
- `still-desktop/tests/agent-loop.test.mjs`
- `still-desktop/tests/assistant-tools.test.mjs`
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`

## Checks
- `pnpm exec tsx --test tests/agent-loop.test.mjs tests/assistant-tools.test.mjs` — 18 passed.
- `pnpm check` — passed.
- `cargo test assistant_agent_protocol` — 11 passed using isolated `CARGO_TARGET_DIR`.
- Isolated Cargo target: `still-desktop/src-tauri/target-agent-tool-review` (4,851,221,496 bytes; 4.52 GiB). Left in place for coordinator review; no build output was deleted.

## Handoff
- Before enabling, the UI must preserve the continuation/proposal only in ephemeral component state, display the exact proposal for review, and call `executeConfirmed` only from the explicit approval button. Then feed its exact `AgentToolExecution` into `resumeAgentLoop`. Declines should resume with a failed, non-mutating receipt or cancel the turn. Clear pending state on workspace/provider changes and unmount.
- No commit was created because this shared checkout has extensive pre-existing dirty work; stage scoped paths only if committing is requested.
