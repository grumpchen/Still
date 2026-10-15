# Task: share attached apps with workspace screenshots

- Agent: Codex
- Time: 2026-10-15T20:57:02+13:00 (Pacific/Auckland)

## Done
- Workspace screenshots now include visible native app panels attached inside the active Still canvas. Detached desktop windows and the assistant panel remain outside the capture.
- Kept screenshots ephemeral and governed by the existing workspace image-sharing setting.
- Bounded each capture to 12 attached panels and 16 million combined CSS pixels; hidden or partially off-canvas panels are skipped.

## Files
- `src/platform/capture.ts`, `src/platform/assistant.ts`, `src/AssistantPanel.tsx`
- `src-tauri/src/capture.rs`, `src-tauri/src/assistant_protocol.rs`
- `tests/assistant-panel.test.mjs`, `tests/assistant-sidebar.test.mjs`

## Checks
- `pnpm exec node --test tests/assistant-panel.test.mjs tests/assistant-sidebar.test.mjs` — passed, 8 tests.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed; Vite emitted its existing large-chunk advisory.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml capture::tests -- --test-threads=1` — passed, 6 tests.
- Native app capture was not manually exercised in the live desktop app.

## Handoff
- Restart Still to load the updated native capture command and frontend.
