# Task: bulk inbox file proposals

- Agent: Codex
- Time: 2026-11-08T14:06:34+13:00 (Pacific/Auckland)

## Done
- Raised the assistant file-move proposal cap from 5 to 100, matching the inbox inspector's maximum listing size.
- Increased inbox tool-result and agent response budgets so bulk proposals can fit; normal requests retain their existing 4096-token response budget.
- Updated inbox guidance to propose all applicable files for an unambiguous bulk move, mention truncated listings, and preserve user review before any move.

## Files
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`
- `still-desktop/src/platform/assistant.ts`
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm exec tsx --test tests/assistant.test.mjs` — passed (55 tests).
- `cargo test --offline assistant_protocol::tests::file_proposals_are_structured_relative_and_separate_from_workspace_actions` — passed.
- `cargo test --offline assistant_agent_protocol::tests::inbox_inspection_is_advertised_only_when_enabled_and_validates_calls` — passed.
- `git diff --check` — passed.

## Handoff
- Changes are committed on `agent/codex/bulk-file-proposals`; not pushed or merged.
- File moves still require user review and approval. A truncated inbox listing is reported as partial.

