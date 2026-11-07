# Task: Verify Still AI actions and memory on Windows

- Agent: Codex (GPT-6.1 Sol)
- Time: 2026-11-07T00:01:36+13:00

## Done

- Fixed assistant intent recognition for requests to create a blank, empty, or new note inside an existing Notes widget. The destination widget no longer adds an unintended widget-creation requirement.
- Changed the note creation receipt to list the created document titles. The previous receipt used the updated widget title as the destination, which could repeat the new document title.

## Files

- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/tests/assistant.test.mjs`

## Checks

- Verified with Gemini 3.1 Flash-Lite in the Windows desktop app and an isolated test profile. A 120-second Focus request showed a proposal and started the timer after approval. The timer entered its running state and Still reported the execution.
- Saved a unique synthetic project name through memory review. Closed and relaunched the app with the same test profile, cleared the restored chat, and confirmed the assistant recalled the exact name without it appearing in the new question.
- Reproduced the note failure and traced it to local intent validation. Repeated the original request after the fix and observed successful creation after review. A second phrasing also worked and the updated receipt listed the new title once.
- All 83 focused assistant tests, TypeScript checking, and Vite build passed. The build retains the existing bundle-size warning.

## Handoff

- The verified runtime was the opt-in agent preview with workspace actions enabled. Other providers and actions outside this test were not exercised.
- One Gemini follow-up still described the completed note as proposed even though the Still receipt showed successful creation.
- Changes depend on earlier uncommitted assistant work in the shared worktree and were left for coordinated staging.
