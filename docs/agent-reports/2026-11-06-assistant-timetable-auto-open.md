# Task: Preserve timetable auto-open preferences

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T10:06:06+13:00

## Done
- Preserve the existing automatic-opening preference when Still AI edits an existing timetable entry.
- Accept and validate boolean autoOpen in the native provider response and Gemini schema, so models can return the timetable data supplied in context.
- Added regression coverage for disabled auto-opening, unsolicited changes and malformed values.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs tests/course-environments.test.mjs` — 56 passed.
- `pnpm check` — passed.
- `cargo test --offline assistant_protocol::tests` — 14 passed; existing unused-method warning.

## Handoff
- Existing course auto-open preferences are preserved during assistant schedule edits; changing that preference through AI needs a separately validated action. Restart/rebuild the native app to load Rust changes. Broader action parity and live provider validation remain open. Existing mixed uncommitted work was preserved; no commit was made.
