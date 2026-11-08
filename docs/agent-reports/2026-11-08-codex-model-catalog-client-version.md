# Task: Codex model catalog client version

- Agent: Codex (GPT-6)
- Time: 2026-11-08T22:15:37+13:00, Pacific/Auckland

## Done
- Compared the last pre-reconnection implementation with the change that introduced the symptom: model discovery moved from `api.openai.com/v1/models` to the Codex catalog endpoint, but sent Still's package version (`0.20.0`) as Codex's `client_version`.
- Switched catalog discovery to the current catalog compatibility version used by Codex's own catalog refresh workflow (`99.99.99`). Sign-in credentials and the existing account connection are unchanged.
- Extracted catalog parsing and added focused regression coverage for listed, hidden, duplicate, and invalid entries.

## Files
- `still-desktop/src-tauri/src/chatgpt_responses.rs`
- `docs/agent-reports/2026-11-08-codex-model-catalog-client-version.md`

## Checks
- `cargo test --offline --manifest-path still-desktop/src-tauri/Cargo.toml --bin still-desktop chatgpt_responses::tests::requests_current_codex_catalog_and_parses_listed_models` — passed (1 test).
- Native development binary build — passed.
- Restarted the native `Still · Live Development` app. Process path and Vite port 4318 both resolve to this checkout.
- `git diff --check` — passed.

## Handoff
- The signed-in account's live model response and inference have not been verified. The native preview restarted, but UI automation could not reliably target the window, so do not treat the unit test/build as proof of live entitlement or inference.
