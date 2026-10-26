# Task: notes-file-explorer

- Agent: Codex GPT-6
- Time: 2026-10-26 Pacific/Auckland

## Done
- Reworked the Notes library panel into a folder explorer with breadcrumbs, current-folder filtering, file types and sizes, and nested navigation.
- Added in-place previews for supported PDF, image, audio, video, Markdown, and text files; previews use existing local file APIs and stay on the device.
- Added creation of Markdown notes in the folder currently being browsed, and an action to open a previewed Markdown or text file in an editable Notes tab.
- Kept file listing bounded and allowlisted; executable/unsupported files remain excluded. The native folder grant still scopes preview and file access.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/NotesWidget.tsx`, `still-desktop/src/platform/notesLibrary.ts`, `still-desktop/src/canvas.css`
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/tests/widget-relaunch.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reports the existing large JavaScript chunk warning.
- `node --test tests/notes-file-persistence.test.mjs` — passed, 8/8.
- `node --test --test-name-pattern="Notes library opens" tests/widget-relaunch.test.mjs` — passed, 1/1; verifies nested folder navigation, Markdown preview, and PDF preview.
- `cargo test --offline --bin still-desktop notes_library_lists_reads_creates_and_safely_replaces_supported_files` — passed, 1/1; covers allowlisted PDF discovery, nested note creation, size bounds, and stale-write protection.
- `git diff --check` — passed.
- Native Tauri development window rebuilt and remains open as `Still · Live Development`.

## Handoff
- Markdown and text preview display their source text; this does not add full Markdown rendering, PDF annotation, or Obsidian plugin compatibility.
- Browser preview cannot select native folders; use the native Still desktop app for this feature.
