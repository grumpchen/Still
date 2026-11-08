# Task: Selected Library context in agent mode

- Agent: Codex with Luna
- Time: 2026-11-08T16:47:04+13:00

## Done
- Agent requests now include only explicitly selected Library resource metadata, notes, and bounded preview text. The serialized context labels source data as untrusted and limits use to selected paths and identifiers.
- Existing compare-only instructions and downstream proposal restrictions remain in place. Names-only Library organisation remains blocked in agent mode; image sharing remains blocked.
- The same user message context is forwarded through the OpenAI-compatible API and ChatGPT agent adapters.
- Added regression coverage for bounded selection context, untrusted-content framing, and forwarding through both adapter routes.

## Files
- still-desktop/src/AssistantPanel.tsx
- still-desktop/src/platform/assistant.ts
- still-desktop/tests/assistant-agent-adapter.test.mjs

## Checks
- `pnpm exec tsx --test --test-name-pattern="explicit Library selections" tests/assistant-agent-adapter.test.mjs` — 1 passed.
- `pnpm exec tsc --noEmit` — passed.
- A broader adapter test invocation had 12 passing tests and one failure in the existing oversized-workspace test: it received a duplicate `inspect-1` call ID before the expected size error. The new focused test passed independently.

## Handoff
- No arbitrary Library browsing or implicit file reads were added. Selected preview text is limited to 24,000 characters per source and the total serialized selection context to 45,000 characters.
