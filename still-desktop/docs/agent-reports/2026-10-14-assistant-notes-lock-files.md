# Task: assistant, Notes, Lock, and Files improvements

- Agent: Codex GPT-6
- Time: 2026-10-14T00:45:13+13:00

## Done
- Saved bounded assistant transcripts per workspace in local storage.
- Added Notes title, font, and size controls and persisted those settings in saved widgets.
- Added a Lock add-on that blocks closing and moving a locked widget; added guards for assistant removal, layout, workspace transfer, stacking, and Group collection.
- Added local PDF, text, image, audio, and video previews plus per-file notes in Files and dropped-document widgets.
- Bounded file previews at 20 MB in native and browser modes. Native reads now run on a blocking worker, with the actual read bounded against a file growing after the metadata check.
- Fixed two stale test assumptions found in review: Focus context is asserted through its timer field rather than a random ID substring, and the widget add-on test includes the new Lock entry.

## Files
- `src/AssistantPanel.tsx`, `src/domain/assistantChat.ts`
- `src/widgets.tsx`, `src/domain/workspaces.ts`, `src/domain/presets.ts`
- `src/WorkspaceCanvas.tsx`, `src/domain/widgetLock.ts`, widget plugin catalog and controls
- `src/FilesWidget.tsx`, `src/DocumentWidget.tsx`, `src/platform/files.ts`, `src/platform/resourceDrop.ts`
- `src-tauri/src/files.rs`, `src-tauri/src/dropped_files.rs`, Tauri command registration and capability
- `tests/assistant-chat.test.mjs`, `tests/widget-lock.test.mjs`, `tests/notes-file-persistence.test.mjs`, `tests/files-preview-lifecycle.test.mjs`, and related updated tests

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reports the existing large JavaScript chunk warning.
- Focused assistant, Lock, Notes, and Files tests passed: 13/13.
- Serial `pnpm test`: 259 passed, 32 failed. The failures are concentrated in tests for the removed Browser widget, pre-v7 workspace schema, old UI selectors, and old website drop behavior. Browser references are also silently skipped during workspace parsing, so legacy Browser widget content needs an explicit migration decision if it must be retained.
- Rust tests could not run because Cargo is not installed in this environment. Native preview changes therefore still need a Windows/Rust build check.

## Handoff
- Still AI remains capability-gated: it edits Notes and Timetable content and shared widget fields, while Files annotations and Apps/Calculator content are not exposed to assistant actions. This is a product-scope limit in the action schema, not a Gemini model limitation.
- The previously pushed checkpoint remains the remote save point. These follow-up changes are local and have not been pushed.
