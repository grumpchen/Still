# Task: isolate native PDF acceptance

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09T09:13:00+13:00 (Pacific/Auckland)

## Done
- Made the native Windows acceptance fixture choose independent free loopback Vite and WebView CDP ports, instead of requiring port 4318 and risking collision with a running Still window.
- Allowed the exact fixture Vite port only for its debug process, while preserving the existing 4318 development origin and production trust boundary. Added Rust coverage for allowed and rejected origins.
- Documented and reran the isolated native `pdf-highlights` scenario. It reads a synthetic PDF through native Files grants, calls a stub ChatGPT subscription provider with only explicitly selected PDF text, applies and clears local overlays, and verifies that the source PDF is unchanged.

## Files
- `still-desktop/src-tauri/src/security.rs`
- `still-desktop/tests/native/assistant-reliability.mjs`
- `still-desktop/tests/native/README.md`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; Vite emitted the existing large-chunk advisory.
- `pnpm.cmd test` — 490 passed, 28 failed out of 518. Failures are in unrelated existing Browser migration, Group/tray UI, startup, and layout assertions; relevant Files folder/marquee, PDF number parsing/selection/wheel, and PDF highlight workflow tests passed.
- Native `pdf-highlights` acceptance — passed in Tauri WebView with isolated fixture files and a stub provider.
- `cargo test --offline security::tests` — passed (1 test) using an isolated Cargo target.
- `rustfmt --edition 2021 --check src/security.rs`, `node --check tests/native/assistant-reliability.mjs`, and `git diff --check` — passed.
- Repository-wide `cargo fmt --check` — not clean with the installed formatter; it proposed changes across many unrelated existing Rust files. No repository-wide formatting was applied.

## Handoff
- This verifies the local AI-highlight workflow with a stub provider, not a live Codex subscription request.
- The 28 broader test failures remain to be triaged separately; they do not touch the files changed in this task. Continue with the remaining Files/agent robustness objective and verify live Codex subscription behavior independently.
