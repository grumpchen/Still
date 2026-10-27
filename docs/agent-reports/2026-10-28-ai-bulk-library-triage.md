# Task: AI classification for multiple Library files

- Agent: Codex
- Time: 2026-10-28T01:23:05+13:00

## Done
- Added a Library search action to classify one to five selected text or PDF sources in a single AI request.
- Kept source comparison separate. Compare requests remain read-only; classification requests pass only selected resources and do not include workspace screenshots or unrelated widget context.
- Extended filing proposals to identify the exact selected Files widget and relative source path. Native and frontend validation reject unsafe paths, duplicate proposals, and more than five proposals.
- The Assistant matches every proposal to a selected source and presents each move for individual confirmation. Users can skip a suggestion; files stay in the inbox unless a move is confirmed. No delete action was added.
- Added English and Simplified Chinese labels and review feedback.

## Files
- `still-desktop/src/LibraryHome.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/tests/assistant.test.mjs`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported the existing large-chunk advisory.
- Focused Rust proposal validation test — passed, including multiple sources, unsafe paths, duplicates, and batch limits.
- `git diff --check` — passed.
- The direct Node assistant test could not load `localization.tsx` under the installed Node 24 runtime; the changed TypeScript compiled successfully.
- Live Windows file-picker and move acceptance were not run.

## Handoff
- Bulk classification is explicit: users search and select files, then review proposed moves individually. Text extraction is bounded, and scanned-PDF OCR is not available. The broader study-platform objective remains in progress.
