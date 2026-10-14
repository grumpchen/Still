# Task: OpenCode Zen provider

- Agent: Codex
- Time: 2026-10-14T20:46:26+13:00

## Done
- Added OpenCode Zen as an assistant provider with secure Windows Credential Manager storage, optional `OPENCODE_API_KEY` startup configuration, model discovery, and chat-completions requests.
- Added provider and model selection in Still AI settings. Unsupported Zen models that require other API protocols are omitted from the picker.
- Updated the empty-reply error wording to match its existing regression test.

## Files
- `src/AssistantPanel.tsx`
- `src/domain/assistant.ts`
- `src-tauri/src/assistant.rs`
- `src-tauri/src/assistant_protocol.rs`
- `src-tauri/src/credential_store.rs`
- `tests/assistant-sidebar.test.mjs`

## Checks
- `cargo test --bin still-desktop`: 86 passed.
- `node --test tests/assistant-panel.test.mjs`: 2 passed.
- Sidebar provider registration test: 1 passed.
- `pnpm build`: passed; Vite reports the existing large-bundle advisory.
- `git diff --check`: passed.
- No live API request was made; no personal key was used.

## Handoff
- Restart/rebuild Still to load the new Rust provider. Open AI settings, select **OpenCode Zen**, paste the Zen API key, and connect. OpenCode usage may consume account credits.
