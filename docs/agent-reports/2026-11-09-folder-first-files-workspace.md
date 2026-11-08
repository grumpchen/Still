# Task: Folder-first Files workspace foundation

- Agent: Codex with GPT-6 Luna context
- Time: 2026-11-09T02:00:25+13:00

## Done
- Made the combined Notes/Files widget open in the selected folder explorer, create Markdown notes inside the current folder, and open the created note in the file preview without switching to a separate Notes page.
- Kept the folder list collapsible beside the breadcrumb and removed the subfolder/content search switches; the search box now filters the current folder.
- Added native “Open with another app” support for a selected file with a native executable picker and revalidation against the existing folder grant.
- Wired pointer-drag selection to file rows with a visible marquee and selected-row styling. Selection is currently visual; bulk file operations are not implemented.
- Updated the plan to preserve the previous rich Notes editor features inside Files and to specify the on-demand PDF number wheel/calculation widget.

## Files
- `still-desktop/src/NotesWidget.tsx`, `NotesLibraryExplorer.tsx`, `platform/files.ts`, `canvas.css`, `localization.tsx`
- `still-desktop/src-tauri/src/files.rs`, `main.rs`, `build.rs`, capability and generated permission files
- `docs/plans/2026-11-09-unified-files-and-pdf-highlights.md`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed after the file selection changes; Vite reports the existing large-chunk advisory.
- `cargo.exe check --offline` from `still-desktop/src-tauri` — passed with existing dead-code warnings.
- Native preview inspection — the open `Still · Live Development` window is running the current checkout at `127.0.0.1:4318`; the Files explorer, folder breadcrumb, current-folder search, and selected Markdown editor were visible. No native file writes or pointer-drag acceptance run was performed.
- `git diff --check` — passed.

## Handoff
- The old Notes search/tabs/tags/links/formatting/AI actions still exist in `NotesWidget.tsx`, but the current default Files path does not expose them for a selected file. Reintegrate them into the in-folder Markdown editor before considering the Notes/Files merge complete.
- Next: restore those note features in Files, then implement the PDF.js text/overlay interaction and persisted calculation widget. Continue checking native behavior and keep the provider paths unchanged.
