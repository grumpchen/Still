# Task: Compact the Files note creation control

- Agent: Codex
- Time: 2026-11-09T16:19:32+13:00

## Done
- Replaced the full-width note-name row with a compact New .md dropdown in the Files toolbar.
- The dropdown contains the name input and create action, closes after successful creation, on outside click, or with Escape.
- Preserved the existing location-aware note creation callback and validation.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`

## Checks
- Not run for this UI-only change.

## Handoff
- Native Still UI was not restarted; check the dropdown in the user's existing window.
