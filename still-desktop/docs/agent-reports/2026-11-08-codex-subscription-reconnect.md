# Task: Codex subscription reconnect

- Agent: Codex
- Time: 2026-11-08T20:48:00+13:00 (Pacific/Auckland)

## Done
- Routed the ChatGPT sign-in connection through Codex’s subscription backend and included its required account identity in model and response requests.
- Updated sign-in to request the signed ChatGPT workspace identity; legacy sessions migrate from their verified ID token when possible and otherwise receive a reconnect error.
- Preserved a rotated refresh token if an older session still needs a new sign-in, and clarified the provider label and settings description.

## Files
- `src-tauri/src/chatgpt_auth.rs`
- `src-tauri/src/chatgpt_plan.rs`
- `src-tauri/src/chatgpt_responses.rs`
- `src/AssistantPanel.tsx`
- `src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the existing large-chunk advisory.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml --bin still-desktop` passed (143 tests).
- `git diff --check` passed.
- Rebuilt and opened the native **Still · Live Development** preview from this checkout. Confirmed the workspace loaded. The existing saved login lacks the Codex account claim, so a signed-in model-list or plan request could not be completed in this session.

## Handoff
- In Still AI settings, select **Continue with ChatGPT** once to refresh the existing connection and grant the Codex workspace identity. Then retry “create new folder” to verify the authenticated model-list and multi-step agent request end to end. No release executable was run or replaced. No merge or push performed.
