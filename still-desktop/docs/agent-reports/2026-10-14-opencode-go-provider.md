# Task: OpenCode Go provider correction

- Agent: Codex (GPT-6)
- Time: 2026-10-14T20:58:21+13:00

## Done
- Corrected the OpenCode integration to use Go model discovery and chat-completions endpoints. The previous Zen endpoints caused the authorization error shown by the user.
- Updated provider labels, errors, and the default model to OpenCode Go and `mimo-v2.6-flash`.
- Filtered Go models that require Responses or Anthropic Messages, and included a stable workspace session header and Still user agent on Go chat requests.
- Updated the focused integration tests. Fixed a stale UI test expectation so it matches the existing explicit layout-intent check.

## Files
- `src-tauri/src/assistant.rs`
- `src-tauri/src/assistant_protocol.rs`
- `src/AssistantPanel.tsx`
- `src/domain/assistant.ts`
- `src/platform/assistant.ts`
- `tests/assistant-sidebar.test.mjs`

## Checks
- `cargo test --manifest-path still-desktop/src-tauri/Cargo.toml --bin still-desktop` — passed, 86 tests.
- `pnpm exec node --test tests/assistant-panel.test.mjs tests/assistant-sidebar.test.mjs` — passed, 8 tests.
- `pnpm build` — passed; Vite reported its existing large-chunk advisory.
- `git diff --check` — passed.

## Handoff
- Rebuild/restart Still, choose **OpenCode Go**, and connect the Go API key again. Key verification had failed before the key was saved.
- Live authenticated Go requests were not tested because no API key was available in this task.
