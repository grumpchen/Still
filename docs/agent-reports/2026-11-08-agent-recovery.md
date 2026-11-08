# Task: Still agent recovery journal

- Agent: Luna, GPT-6.1
- Time: 2026-11-08T17:29:00+13:00

## Done
- Added a bounded, versioned native journal for reviewed inbox move batches. The full ordered batch is durably written as pending before any file operation; each move is durably marked as attempting immediately before dispatch.
- Both provider approval and final-answer proposal approval use the same journaling path. Startup recovery is scoped to the originating workspace and currently authorized inbox. It never replays pending or interrupted operations.
- Recovery verifies source/destination evidence and, on Windows, file identity (volume serial and file index) to recognize the hard-link move after a crash before its receipt flush. Missing, replaced, linked, inaccessible, or ambiguous destinations are reported as uncertain. Unsupported identity checks do not claim verified completion.
- Added per-workspace recovered history with explicit dismissal. The inbox history is exposed as `data-testid="assistant-recovered-operations"`.
- Corrupt or unreadable journals fail closed and are not overwritten. No prompts, provider traces, API keys, or file contents are journaled.

## Files
- `still-desktop/src-tauri/src/assistant_journal.rs`
- `still-desktop/src-tauri/src/files.rs`, `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src/AssistantPanel.tsx`, `still-desktop/src/domain/assistantInbox.ts`, `still-desktop/src/platform/files.ts`
- `still-desktop/tests/assistant-inbox.test.mjs`

## Checks
- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec tsx --test --test-concurrency=1 tests/assistant-inbox.test.mjs` — 5 passed.
- `cargo test --offline --bin still-desktop` — 137 passed, 0 failed (one pre-existing dead-code warning).
- Focused native journal tests cover a crash after the hard-link move without receipt, replacement destination ambiguity, bounded journal persistence, and per-file attempt-before-dispatch behavior.

## Handoff
- No native WebView restart acceptance was run in this worktree. Coordinator harness acceptance should terminate after move one and before move two, then confirm one verified completion and one pending review in `assistant-recovered-operations`.
- Windows file identity is required to report a recovered move as verified. Other filesystems without an available identity remain uncertain and require manual inspection.
- No merge or push.
