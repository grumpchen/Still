# Task: DeepSeek provider

- Agent: Codex (GPT-6)
- Time: 2026-11-10T21:40:15+00:00

## Done
- Added DeepSeek as a selectable assistant provider, with model discovery, secure saved-key integration, API-key settings link, chat completions, and compatible agent tool turns.
- Used DeepSeek's JSON-object response format and `max_tokens`; screenshot data is omitted because the supported DeepSeek chat models do not accept images.
- Added focused Rust protocol tests and updated the sidebar provider expectations.

## Files
- `src-tauri/src/assistant.rs`
- `src-tauri/src/assistant_agent_protocol.rs`
- `src-tauri/src/assistant_library_protocol_tests.rs`
- `src-tauri/src/assistant_protocol.rs`
- `src-tauri/src/credential_store.rs`
- `src/AssistantPanel.tsx`
- `src/domain/assistant.ts`
- `tests/assistant-sidebar.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm exec tsx --test --test-concurrency=1 tests/assistant-panel.test.mjs tests/assistant-sidebar.test.mjs` — passed, 11 tests.
- `pnpm test` — existing release snapshot has multiple unrelated failures; the focused assistant tests pass.
- `cargo test` — not run; `cargo` and `rustc` are unavailable in this environment.
- No live provider request was made; local checks use no DeepSeek API credits.

## Handoff
- Branch is based on release tag `v0.235`. Rebuild the desktop app and enter the DeepSeek key through its AI settings to try a live request. The local Rust backend/tests still need compilation in a Rust-equipped environment.
