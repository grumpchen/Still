# Task: Codex token lifetime validation

- Agent: Codex
- Time: 2026-11-08T21:41:57+13:00 (Pacific/Auckland)

## Done
- Compared the prior `/api/accounts/oauth/token` flow with the Codex `/oauth/token` flow. The Codex endpoint inherited a strict one-day maximum from the old response validator.
- Added a regression where a valid seven-day Codex token response reproduces the old rejection, then removed the arbitrary upper bound. Zero-length lifetimes remain rejected, and signed ID-token, nonce, account, token-type, scope, and refresh-token checks remain in place.
- Retained secret-free error categories for invalid token fields.

## Files
- `still-desktop/src-tauri/src/chatgpt_auth.rs`
- `docs/agent-reports/2026-11-08-codex-token-lifetime-validation.md`

## Checks
- `cargo test --offline --test chatgpt_auth_scaffold accepts_codex_token_lifetimes_longer_than_one_day -- --nocapture` failed before the fix at the old 86,400-second ceiling.
- `cargo test --offline --test chatgpt_auth_scaffold -- --nocapture` passed (13 tests) after the fix.
- The lifetime mismatch is a code-level reproduction of the screenshot's generic validation error, but the exact lifetime in the user's private token response was not observed.
- Native rebuild is in progress; successful live OAuth reconnect has not yet been verified.

## Handoff
- Verify the rebuilt Still · Live Development window, reconnect once, and confirm the error is gone and Codex models load. If a new categorized error appears, use it to continue without exposing callback URLs or token contents. No release executable was run, replaced, pushed, or merged.

