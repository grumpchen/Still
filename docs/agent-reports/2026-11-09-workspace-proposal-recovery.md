# Task: Workspace proposal recovery

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09

## Done
- Extended metadata-only recovery from ordinary confirmation cards to Files moves, Library organization and Undo, calendar additions, note edits, and AI summary-note creation.
- Each proposal records an `awaiting_review` marker before it is shown. Applying moves it to `applying`; the actual receipt is written to chat before the recovery marker is cleared.
- A failed or interrupted apply is never replayed. Still surfaces an uncertainty notice and disables the old proposal until the user inspects the workspace; acknowledgement clears the stale proposal so a new one must be prepared.
- Kept file-move journaling in place alongside the general recovery marker, so native per-move receipts remain available after partial execution.
- Preserved the existing folder-first Files experience and Study with AI summary flow.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/AssistantLibraryTools.tsx`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`
- `still-desktop/tests/assistant-library-tools.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Focused recovery unit tests — 6 passed.
- Focused review UI tests — 3 passed: layout restart recovery, Study with AI summary creation, and Library Apply/Undo.
- Existing Files-first, Markdown tabs/editing, and summary-note regression tests — 3 passed in the preceding increment.
- `git diff --check` — passed.
- Native desktop behavior was not restarted or interactively tested.

## Handoff
- Calendar and standard file proposal recovery are implemented through the same shared lifecycle, but this increment did not add a dedicated end-to-end acceptance test for each of those two UI cards.
- Continue reviewing provider-specific execution and native Files/PDF behavior; source-level and mocked UI checks do not establish native acceptance.
