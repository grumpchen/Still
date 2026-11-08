# Task: create a reviewed AI summary note

- Agent: Codex (GPT-6)
- Time: 2026-11-09T04:45:45+13:00, Pacific/Auckland

## Done
- Added a separate “Create summary note” study action. The selected provider returns a Markdown draft; Still shows it and a suggested title for review before any note is saved.
- For a Library-backed note, approval creates the Markdown summary in the source note's folder using the same folder grant. Still checks the source note identity, compares its current contents with the captured text, and writes content as part of the create operation. A stale source is rejected and the original is never overwritten.
- For a local note without a Library path, approval creates a separate local note document.
- Summary requests are bounded to 24,000 source characters. Still tells the model and reviewer when it received only an excerpt.
- Existing Explain, Summarize-in-chat, Flashcards, Outline, Quiz, Files preview/open actions, and PDF tools remain available.

## Files
- `still-desktop/src/NoteRichEditor.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/platform/notesLibrary.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/tests/widget-relaunch.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; Vite emitted its existing large-chunk advisory.
- `node --import tsx --test --test-name-pattern="AI summary notes" tests/widget-relaunch.test.mjs` — passed (1 focused UI integration test), including folder placement, opening the new note in Files, unchanged source text, and stale-source rejection.
- Isolated native file test `files::tests::notes_library_lists_reads_creates_and_safely_replaces_supported_files` — passed (1 test), including content creation, Unicode names, size checks, collisions, and folder containment.
- `git diff --check` — passed.
- The running native preview was not restarted. A live provider response and native desktop click-through remain unverified.

## Handoff
- The assistant review and save handshake is tested with the existing selected-provider event path; live model generation is not simulated by the focused test.
- The broad Still robustness objective remains active. Continue provider round-trip verification and native PDF acceptance when a disposable fixture can be used without changing the user's Library.
