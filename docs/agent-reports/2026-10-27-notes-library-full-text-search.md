# Task: notes-library-full-text-search

- Agent: Codex GPT-6
- Time: 2026-10-27T23:26:00+13:00

## Done
- Added optional full-text search for Markdown and UTF-8 text notes in the selected Notes library.
- Search results include the relative path and a short excerpt around the match; choosing a result opens it in the existing preview flow.
- Added native bounds: 120-character query, existing 10,000-entry/500-file/depth-limited library index, 1 MB per note, 20 MB total read budget, and at most 100 results.
- The native command uses the existing folder grant, skips symlinks through the library index, runs off the UI thread, and returns no absolute path.
- Added bilingual search controls and a visible message when a safety limit truncates results.

## Files
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src/platform/notesLibrary.ts`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (642.30 kB).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed; pre-existing unused `set_chrome_profile` warning remains.
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- Full-text search is local and read-only. AI sees file contents only after the user explicitly selects and sends a note.
