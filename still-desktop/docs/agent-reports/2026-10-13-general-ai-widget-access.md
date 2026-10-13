# Task: general-ai-widget-access

- Agent: Codex (GPT-6)
- Time: 2026-10-13T19:43:42+13:00 (Pacific/Auckland)

## Done
- Reproduced the missing “make” creation intent, rejection of valid action-only responses, and the advertised `remove_widget` action missing from Rust's decoder.
- Added ordinary creation wording for every built-in widget, a complete capability catalogue, and optional new-widget titles and initial Notes content.
- Enabled general conversational follow-ups and reviewable model interpretations instead of rejecting them for missing local phrases. Kept destructive actions confirmed and preserved batch/workspace limits.
- Replaced the combined “oversized or empty” rejection with clearer errors; valid actions with empty prose now receive a neutral receipt placeholder before the application reports the actual outcome.

## Files
- `src/domain/assistant.ts`, `src/AssistantPanel.tsx`
- `src-tauri/src/assistant_protocol.rs`
- Assistant domain, sidebar-contract and rendered-panel tests
- AI usage notes and the general-assistant design document

## Checks
- Exact-command frontend test was observed failing with an empty intent list before the fix.
- Rust catalogue test was observed failing because `remove_widget` could not be decoded before the fix.
- `node --test --test-concurrency=1 tests/assistant.test.mjs tests/assistant-sidebar.test.mjs tests/assistant-panel.test.mjs`: 31 passed.
- `cargo test --manifest-path src-tauri/Cargo.toml assistant_protocol -- --test-threads=1`: 9 passed.
- `pnpm.cmd build`: passed, including TypeScript checking.
- `git diff --check`: passed.

## Handoff
- The active development app rebuilt through the existing watcher; its running executable is newer than the updated Rust source. Vite is reachable on port 4318.
- Real Gemini payloads were not captured or replayed. The screenshot's exact invalid payload is unknown; fixtures reproduce the relevant validator failures and the exact user command no longer depends on Gemini.
- Existing unrelated working-tree changes were preserved. General chat is broader; native OS control and unimplemented Still controls are not implied by the action catalogue.
- Future improvements: generate the TS/Rust action definitions from one schema to prevent the decoder mismatch found here. The successful build now reports a 500 kB bundle warning; measure and split lazy-loaded assistant/widget UI to reduce startup work in a separate performance change.
