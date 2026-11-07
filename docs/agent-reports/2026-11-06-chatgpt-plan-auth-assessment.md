# Task: ChatGPT plan authentication assessment

- Agent: Codex (GPT-6)
- Time: 2026-11-06, Pacific/Auckland (UTC+13)

## Done
- Reviewed the Still agent runtime plan, current provider implementation, checkout instructions, and existing worktree state.
- Verified the current OpenAI docs for the open-source Sign in with ChatGPT flow and Codex app-server.
- Added an isolated, unregistered Rust scaffold for dynamic public-client authorization URL construction with fresh cryptographic PKCE verifier/state/nonce, S256 challenge, strict loopback callback checks, denial/duplicate parameter handling, and mandatory returned issued client ID. Debug output redacts verifier, nonce, state, and authorization code.
- Added fixed OpenAI token/JWKS endpoint helpers with bounded response sizes, timeouts, and redirects disabled; authorization-code and refresh grant form builders; RS256 ID-token verification using `jsonwebtoken`; issuer, audience, expiry, subject, nonce, and same-subject refresh checks; and required granted-scope checks. Refreshed token data is returned only after validation. No request to OpenAI was made.
- The current app still has API-key OpenAI support over Chat Completions, but no integrated OAuth account lifecycle, native loopback listener, explicit browser launch, native credential persistence, or Responses app-server adapter. The scaffold is not functional sign-in and is not connected to the app.
- The documented OSS registration flow uses `dynamic_agent_client` for first registration and returns an issued client ID; the user must complete and approve sign-in in the system browser. The docs specify PKCE, loopback redirect on `127.0.0.1`, validating the callback and ID token, checking granted scopes, and safely storing/refreshing per-account credentials. The app-server integration then receives the access token through its child-process environment and uses the Responses API.
- The local Codex executable exposes `codex app-server` (`--help` inspected only). No Codex account credentials or session files were accessed.

## Files
- `docs/agent-reports/2026-11-06-chatgpt-plan-auth-assessment.md`
- `still-desktop/src-tauri/src/chatgpt_auth.rs`
- `still-desktop/src-tauri/tests/chatgpt_auth_scaffold.rs`
- `still-desktop/src-tauri/tests/fixtures/chatgpt_test_private.pem` (synthetic test-only RSA key from the MIT-licensed `jsonwebtoken` crate tests)
- `still-desktop/src-tauri/tests/fixtures/README.md`
- `still-desktop/src-tauri/Cargo.toml` and `still-desktop/src-tauri/Cargo.lock` (`ring` for secure randomness/SHA-256; pinned `jsonwebtoken` for RS256 verification)

## Checks
- Focused tests passed: `$env:CARGO_TARGET_DIR=$env:TEMP\still-chatgpt-auth-test-target; cargo test --offline --manifest-path src-tauri/Cargo.toml --test chatgpt_auth_scaffold` (8 passed). Tests use synthetic RSA/JWKS fixtures and no production network. The existing shared target could not replace the running `still-desktop.exe`, so tests used an isolated temp target; the app was not stopped.
- Opened `codex.exe app-server --help`; confirmed the installed runtime exposes the app-server entrypoint.
- Verified official docs: https://developers.openai.com/siwc/token-sharing-open-source/sign-in and https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server .
- No real account, browser consent, token exchange, JWKS fetch, refresh, credential write, or inference was attempted.

## Handoff
- A real connection is technically plausible through the documented open-source dynamic registration and local Codex app-server, but cannot be completed by wiring the current OpenAI API-key provider. Remaining work is a native loopback listener, explicit user-initiated browser launch, protected per-account session storage, token rotation persistence/recovery, Responses app-server lifecycle, model entitlement handling, and authorized live inference verification. In-flight HTTP requests can be canceled by dropping their Rust future, but no UI cancellation path exists.
- Windows Credential Manager limits each credential blob to 2,560 bytes. A single serialized access/refresh/ID-token record may exceed that; splitting secrets across entries makes rotating refresh-token updates non-atomic without additional generation/commit recovery design. No native token storage was added. Microsoft reference: https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw .
- Keep this scaffold unavailable and unregistered. Do not present partial OAuth as sign-in. OpenAI's identity guide says Sign in with ChatGPT is currently available to selected commercial partners through a limited trial, so eligibility for a distributable Still release needs confirmation. Never read or reuse the separate Codex installation's credentials.
