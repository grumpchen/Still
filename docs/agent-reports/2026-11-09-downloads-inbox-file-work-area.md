# Task: Downloads Inbox preview and Files work area

- Agent: Codex GPT-6
- Time: 2026-11-09T14:16:49+13:00

## Done
- Downloads Inbox now keeps the searchable file list visible beside a dedicated preview and file-notes pane.
- PDFs in Files use Still's PDF viewer instead of a WebView PDF iframe, including its existing zoom, number selection, and keyword-highlight workflow.
- Unsupported documents still show the explicit preview limitation and the default/alternate app actions; Office lock-file handling is preserved.
- Moved the Files sidebar collapse arrow to the first position in the breadcrumb row and gave the unified Files explorer a clearer list/preview split without the negative left margin.

## Files
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- `git diff --check` — passed.
- Targeted component tests were attempted, but the Vite SSR test harness timed out while fetching modules (`TimerWidget.tsx`, then `DocumentWidget.tsx`) after 60 seconds. No test pass is claimed.
- The existing native Still window was inspected: it is the current checkout's `src-tauri/target/debug/still-desktop.exe` at `127.0.0.1:4318`. It was left open and unchanged; the updated Files workflow was not manually exercised there.

## Handoff
- Build and type checks do not establish the real Downloads Inbox file-grant/open behavior. Verify PDF, image/text, unsupported DOCX default-app launch, Office lock-file handling, and small-widget layout in the current native window before calling the native flow accepted.
