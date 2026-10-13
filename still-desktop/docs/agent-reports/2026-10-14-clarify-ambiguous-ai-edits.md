# Task: clarify ambiguous AI edits

- Agent: Codex
- Time: 2026-10-14T10:17:22+13:00

## Done
- Added a local clarification step for vague edit requests such as `edit the timetable`, `can you edit it?`, and `make the notes better`; no provider request or workspace change happens until the user supplies specifics.
- Suppressed any provider-returned workspace action when the provider's reply asks a clarification question.
- Updated shared Gemini/OpenAI guidance to ask a concise follow-up for underspecified edits while keeping clear requests direct.
- Documented the behavior and verified the live Still desktop window remains open.

## Files
- `src/domain/assistant.ts`
- `src/AssistantPanel.tsx`
- `src-tauri/src/assistant_protocol.rs`
- `docs/plans/2026-10-11-gemini-sidebar.md`
- Assistant tests

## Checks
- `node --test --test-concurrency=1 tests/assistant.test.mjs tests/assistant-panel.test.mjs tests/assistant-sidebar.test.mjs` — 38 passed.
- `pnpm check` — passed.
- Tauri development build recompiled and relaunched; `still-desktop` remains running as `Still · Live Development`.

## Handoff
- Clear widget actions remain direct. Existing destructive-action confirmations are unchanged.
