# Task: Agent memory tool foundation

- Agent: Luna
- Time: 2026-11-06T17:40:09+13:00

## Done
- Added a separate default-off `enable_assistant_memory_tool` protocol gate for Gemini and OpenAI-compatible adapters. The model can only propose one bounded memory string; protocol validation rejects missing, oversized, control-character, or unknown inputs.
- Added a separate default-off `enableAssistantMemoryTool` registry gate. Proposal requires an injected validator for the exact user request, remains unwritten until explicit approval, binds approval to the exact pending proposal object, revalidates intent, and persists through the existing `addAssistantMemory` API.
- Approval returns the stored entry and receipt; quota/read errors do not claim success, and uncertain writes are marked `unknown`.
- Updated the native command to pass the new gate to provider response parsers. UI and `platform/assistant.ts` are unchanged, so the feature is not wired or advertised by the current panel.
- Gemini model Content and call IDs continue to be replayed unchanged, including signed Parts.

## Files
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`
- `still-desktop/src-tauri/src/assistant.rs`
- `still-desktop/src/domain/assistantTools.ts`
- `still-desktop/tests/assistant-tools.test.mjs`

## Checks
- `cargo test --offline --manifest-path still-desktop/src-tauri/Cargo.toml --bin still-desktop assistant_agent_protocol` — 19 passed.
- `pnpm exec tsx --test tests/assistant-tools.test.mjs` — 12 passed.
- `pnpm check` — passed.

## Handoff
- The panel must set both gates only for explicit current-turn memory requests and provide `validateMemoryIntent` bound to the original user prompt. Keep approval preview exact, then call `executeConfirmedMemory` and resume the same provider run with its returned receipt. Do not expose raw Gemini content in displayed or persisted chat.
- Changes remain uncommitted in the shared checkout; no unrelated files were altered by this task.
