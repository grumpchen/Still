# Task: Gemini key connection failure

- Agent: Codex (GPT-6)
- Time: 2026-10-11 (Pacific/Auckland)

## Finding and change
- The Connect action only applied a local ASCII alphanumeric/`-`/`_` allowlist; it never contacted Google. A rejected input was replaced by one generic UI error, hiding whether rejection came from validation or Tauri authorization.
- Replaced the arbitrary alphabet check with bounded printable-header validation, and verify nonempty keys against Google's Models endpoint using the documented `x-goog-api-key` header before saving them to session memory.
- Surface the safe, actionable error returned by the native validation command. The key remains session-only and is not logged or persisted.

## Checks
- Red/green: `assistant::tests::accepts_opaque_printable_api_key_values` failed before the validation change and passed afterward.
- `cargo test --manifest-path src-tauri/Cargo.toml assistant`: 7 passed.
- `node --test tests/assistant.test.mjs`: 6 passed.
- `pnpm build`: TypeScript and Vite production build passed.
- `pnpm tauri build --no-bundle` with `CARGO_PROFILE_RELEASE_DEBUG=0`: succeeded.
- `git diff --check`: passed.

## Handoff
- Updated test executable: `C:\Users\haoka\Projects\Default Project\Still-Gemini-Sidebar-Test-20261011.exe` (SHA-256 `30D7B294D550FD845908BFA3BA3E3BF0B7BD4F3CBD72454CA4A3B706499ECBB2`). It was built but not launched.
- PR #4 is updated from `agent/codex/gemini-sidebar`; no merge performed.
- No live request used the user's key, so its project authorization and Windows GUI behavior still require user testing. Google may reject keys that are inactive, restricted from the Gemini API, or blocked by current key policy.
