# Task: notes-library-global-search

- Agent: Codex GPT-6
- Time: 2026-10-27T22:53:00+13:00

## Done
- Added an optional search across the selected Notes library's indexed files and subfolders.
- Matches file names and relative paths and displays each result's containing folder.
- Kept search inside the existing user-selected native folder grant; no additional paths are scanned.
- Localized the new search controls in English and Simplified Chinese.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (636.38 kB).
- `git diff --check` — passed.

## Handoff
- Search matches file names and paths, not the text inside every note. Full-text indexing is not implemented.
