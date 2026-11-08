# Task: harden Codex subscription reauthorization

- Agent: Codex (GPT-6)
- Time: 2026-11-09T06:25:00+13:00, Pacific/Auckland

## Done
- Made the token response `scope` field optional. OAuth permits omitting it when the returned grant is unchanged; when omitted, Still validates the scopes it requested. Explicitly reduced scopes still fail validation.
- Stopped rejecting a fresh authorization solely because its OIDC subject changed. Reauthorization continues to compare the verified Codex account ID, with a case-insensitive email check for older records that predate account IDs. Refresh continues to require the existing subject.
- Added synthetic regressions for an omitted scope, changed OIDC subject on the same account, and rejected different-account identity.

## Checks
- `cargo test --offline --test chatgpt_auth_scaffold` using an isolated Cargo target — 14 passed.
- `cargo test --offline --bin still-desktop chatgpt_plan::tests` using the same isolated target — 4 passed.
- `git diff --check` — passed.
- `cargo fmt -- --check` reports pre-existing formatting differences across the Tauri crate and build script; it was not applied because that would reformat unrelated files.
- No live OAuth login or account inference was performed. This addresses two source-level failure modes, but a real account round trip remains unverified.

## Handoff
- Preserve API provider connections and the subscription path. Verify the real ChatGPT account connection in the native preview when available; do not claim the login is fixed from mocked tests alone.
