# Task: Codex OAuth flow correction

- Agent: Codex
- Time: 2026-11-08T21:06:00+13:00 (Pacific/Auckland)

## Done
- Corrected the previous fix: it added identity-request parameters to Still's old dynamic-agent OAuth flow, which still did not issue Codex subscription identity.
- Switched sign-in, token refresh, and revocation to the current Codex OAuth client, endpoints, and connector scopes. Uses the registered localhost loopback ports 1455/1457 and verifies the returned signed ID token's account identity.
- Old dynamic-agent sessions now request a new Codex sign-in instead of trying to refresh through the incompatible flow. Existing encrypted records remain readable.

## Files
- `src-tauri/src/chatgpt_auth.rs`
- `src-tauri/src/chatgpt_plan.rs`

## Checks
- The new OAuth-flow regression test failed before the correction at the old authorization endpoint, then passed after the change.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml --bin still-desktop` passed (144 tests).
- `pnpm check`, `pnpm build`, and `git diff --check` passed; Vite reported the existing large-chunk advisory.
- Rebuilt and opened the native **Still · Live Development** preview from this checkout. The OAuth request and signed account identity path are unit-tested; a successful account sign-in and live subscription request still require user interaction and are not claimed as verified.

## Handoff
- The old saved session is intentionally rejected as incompatible. After this build is running, choose **Continue with ChatGPT** again, then verify model loading and a small agent request. No release executable was run or replaced. No merge or push performed.
