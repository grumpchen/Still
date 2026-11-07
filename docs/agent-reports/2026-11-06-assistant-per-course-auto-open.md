# Task: Assistant per-course automatic opening

- Agent: Codex (GPT-6.1 Terra)
- Time: 2026-11-06T10:15:02+13:00

## Done
- Added a bounded action to enable or disable automatic opening for one uniquely named linked timetable course.
- Ask for clarification when no linked course or multiple courses match; preserve other courses and the global setting.
- Added native protocol schema and validation, undoable application, and a full-app test.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`
- `still-desktop/tests/e2e/dashboard-assistant.spec.ts`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 52 passed.
- `cargo test --offline assistant_protocol::tests` — 15 passed; existing unused-method warning.
- Focused Playwright per-course change and undo — passed.
- `pnpm build` — passed; existing large-chunk warning.

## Handoff
- The local command requires the exact course name and a linked environment. Native rebuild/restart and live provider testing remain pending; broader action parity remains open. Existing mixed uncommitted work was preserved; no commit was made.
