# Task: Assistant course environment setting

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T10:09:19+13:00

## Done
- Added explicit assistant on/off commands for the global automatic course-environment setting, with undo and native protocol validation.
- Kept per-course wording from being interpreted as a global setting and prevented negated enable/disable commands from being applied locally.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 51 passed; `pnpm check` passed.
- `cargo test --offline assistant_protocol::tests` — 14 passed; existing unused-method warning.
- Focused Playwright global setting and undo test — passed; Vite reported transient EBUSY watcher warnings while Cargo compiled concurrently.

## Handoff
- Per-course auto-open control and live native/provider validation remain open. Rust changes require a native rebuild/restart. Existing mixed uncommitted work was preserved; no commit was made.
