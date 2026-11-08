# Task: Codex reauthorization identity migration

- Agent: Codex
- Time: 2026-11-08T21:57:31+13:00 (Pacific/Auckland)

## Done
- Traced the new identity error to chatgpt_plan_connect: after switching to the fixed Codex OAuth client, it still compared the new ID-token subject with the subject saved under the old dynamic OAuth client.
- Changed reauthorization to compare subjects only when the saved registration uses the same OAuth client. OpenID subjects can be client-specific.
- When a previous account ID is available, still requires the reauthorized identity to carry that same account ID. Older records without an account ID can complete the explicit reauthorization.
- Added regression tests for legacy-client migration, same-client subject continuity, and account-ID continuity.

## Files
- still-desktop/src-tauri/src/chatgpt_plan.rs
- docs/agent-reports/2026-11-08-codex-reauthorization-identity.md

## Checks
- cargo test --offline --bin still-desktop reauthorization_does_not_compare_subjects_from_a_different_oauth_client -- --nocapture failed before the fix because the legacy subject was passed through.
- cargo test --offline --quiet --bin still-desktop chatgpt_plan::tests::reauthorization_ -- --test-threads=1 passed (3 tests) after the fix.
- The ChatGPT auth scaffold passed all 13 tests after the preceding token-lifetime change.
- git diff --check passed.
- A live OpenAI authorization following this change has not yet been verified.

## Handoff
- Rebuild the Still development app and verify reauthorization through the OpenAI workspace selection screen. The failure was caused by comparing identity subjects across different OAuth clients; if an older saved account ID exists, changes to that account are still rejected. Do not run or replace the release executable.
