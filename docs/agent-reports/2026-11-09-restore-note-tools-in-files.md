# Task: Restore note tools in the Files workspace

- Agent: Codex (GPT-6)
- Time: 2026-11-09T02:13:48+13:00

## Done
- Restored the existing Notes editing workflow in the folder-first Files view: open-note search and tabs, tags, formatting, font controls, note links/backlinks, Study with AI actions, and file-backed editing with the existing conflict/reload handling.
- New notes continue to be created in the selected folder; legacy local note documents remain available in tabs.
- Kept the standalone Notes mode removed so the combined Files workspace remains the default.

## Files
- `still-desktop/src/NoteRichEditor.tsx`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm.cmd build` passed (includes TypeScript type checking); Vite reports the existing large-chunk advisory.
- `git diff --check` passed.
- Native Still live preview at `127.0.0.1:4318`: visually inspected the current checkout and verified note tabs/search, tags, formatting/font/link controls, note editor, and Study with AI menu. No note or file contents were changed during inspection.

## Handoff
- This verifies the note editor controls render in the native preview, not a full save/reload/conflict workflow against a user file.
- Continue with the planned PDF.js number selection and dedicated calculation widget. PDF.js and math widget implementation/verification are still pending.
