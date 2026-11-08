# Task: Agent recovery journal hardening

- Agent: Luna, GPT-6.1
- Time: 2026-11-08T17:35:00+13:00

## Done
- Added process-local live attempt IDs inside the journal mutex. Listing skips an in-flight attempt; a new process loads an empty live-ID set and reconciles durable records from disk. Finish settles and removes the live ID only when its journal update is flushed, so a failed receipt write remains recoverable.
- Updated recovery history labels to identify prior completed receipts as historical, distinguish results checked against the current inbox, and show unknown states as unverified instead of complete.

## Files
- `still-desktop/src-tauri/src/assistant_journal.rs`
- `still-desktop/src/AssistantPanel.tsx`

## Checks
- Focused journal tests: 3 passed, including live-attempt skip and simulated process reload.
- `cargo test --offline --bin still-desktop` — 138 passed, 0 failed (one pre-existing dead-code warning).
- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec tsx --test --test-concurrency=1 tests/assistant-inbox.test.mjs` — 5 passed.
- `git diff --check` — passed.

## Handoff
- The coordinator is adding the command ACL entries after the native fixture found them missing; this follow-up does not modify that ACL patch.
