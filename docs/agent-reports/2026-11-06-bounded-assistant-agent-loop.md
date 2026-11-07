# Task: bounded assistant agent loop

- Agent: Codex sub-agent
- Time: 2026-11-06T15:17:56+13:00 (Pacific/Auckland)

## Done
- Added a reusable provider-independent TypeScript loop that sends tool call rounds to allowlisted handlers, appends actual execution receipts to provider-owned history, and continues requesting model turns.
- Bounded tool rounds and calls, sequentially executes calls, validates IDs and receipts, rejects inherited registry names, supports AbortSignal cancellation, and distinguishes no tools, successful no-op, successful mutation, failure, and partial/uncertain failure.
- This module is standalone and is not integrated into the Assistant panel/provider yet.

## Files
- `still-desktop/src/domain/agentLoop.ts`
- `still-desktop/tests/agent-loop.test.mjs`

## Checks
- `pnpm exec tsx --test tests/agent-loop.test.mjs` — 10 passed.
- `pnpm check` — passed.

## Handoff
- A provider adapter should map each `AgentModelTurn` tool call to the provider's native assistant/tool-call messages, and implement `appendToolRound` with the exact `AgentToolCallResult.execution` values. The next model request must receive those tool result messages; do not pass a locally predicted receipt.
- Register tools with `createAgentToolDispatcher` and `defineAgentTool` for input parsing. Keep an allowlist; enforce permissions/confirmation before mutating or external operations. `runAgentLoop` does not implement policy prompts, provider authentication, transport, persistence, streaming, or UI.
- Render final prose alongside `actionOutcome` and `toolResults`; the model's final text is not proof of an action. A thrown operation is conservatively `mutation: 'unknown'`; tool implementations should return `partial` when they can establish partial changes. Cancellation cannot stop an operation that ignores its passed signal, so that handler must report its actual result.
- No existing assistant files were edited; pre-existing dirty assistant work was preserved. No commit made in the shared working tree.
