# Task: Move Files create controls to the folder row

- Agent: Codex
- Time: 2026-11-09T16:15:00+13:00

## Done
- Moved New .md and New folder from the note-name input row into the folder navigation row, beside the current path and filter.
- Kept note creation wired to its existing validated form submission.
- Fixed a stale open-request race that could leave the parent Notes widget busy after a later open request returned early, keeping Change folder disabled.
- Corrected the Files sidebar toggle glyph rendering.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Files Explorer focused tests — 4 passed.
- `git diff --check` — passed.
- Native Still UI was not restarted or visually checked.

## Handoff
- Change folder and refresh remain disabled while an actual folder or note operation is in progress. The request-order fix prevents a rejected/early-return note open from stranding that busy state.
- Native layout verification remains for the user to check in their existing Still window.
