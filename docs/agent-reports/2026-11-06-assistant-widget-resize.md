# Task: Assistant widget resize proposals

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T09:51:33+13:00

## Done
- Route requests to resize a single expanded widget through the reviewed layout proposal and existing undo path.
- Clarify ambiguous targets; validate that other placements remain unchanged, the requested direction and explicit dimensions match, and existing canvas and overlap rules hold.
- Instruct both provider paths to propose resizes as layouts.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 51 passed.
- `pnpm exec tsx --test tests/assistant-panel.test.mjs` — 3 passed.
- `cargo test --offline assistant_protocol::tests` — 13 passed via full Cargo path; existing unused-method warning.
- `pnpm build` — passed; existing large-chunk warning.

## Handoff
- Resize requires a configured provider and an explicit Apply to the proposal. Live provider/native acceptance and broader action parity remain open. Existing mixed uncommitted work was preserved; no commit was made.
