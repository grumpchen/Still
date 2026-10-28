# Task: AI credential loading

- Agent: Codex
- Time: 2026-10-28T19:19:17+13:00

## Done
- Corrected the Windows Credential Manager not-found check to recognize both Win32 error 1168 and HRESULT `0x80070490` for reads and deletes.
- Added a regression test for absent credentials versus unrelated errors.
- Confirmed Gemini and OpenCode entries exist; no OpenAI entry was found. No key values were read or displayed.
- The live development app restarted after the native rebuild; the false missing-key warning did not recur on the subsequent launch.

## Files
- `src-tauri/src/credential_store.rs`
- `docs/plans/2026-10-28-study-workspace-reliability.md`

## Checks
- `cargo test --offline`: 91 passed.
- `pnpm exec tsx --test --test-concurrency=1 tests/assistant-panel.test.mjs tests/assistant.test.mjs`: 35 passed.
- `pnpm check`: passed.
- Still dev preview rebuilt and relaunched. A pre-rebuild launch emitted the prior warning; the post-fix launch did not.

## Handoff
- AI credentials are stored outside Codex config. OpenAI still needs its own key if selected. Continue with the all-workspace Library, Notes folder flow, sidebar control, and drag performance tasks in the plan.
