# Task: Notes formatting

- Agent: Codex
- Time: 2026-11-28, UTC

## Done
- Notes content now renders Markdown headings, bold text, bullets, numbered lists, and interactive task checkboxes in an editable rich text surface.
- The editor continues to store the existing Markdown/plain text representation, preserving old workspace and library note data.
- Formatting preserves selection; Ctrl+Z stays in the focused editor instead of invoking workspace undo. The Windows native shortcut accelerator now defers undo to editable controls.
- Added the agreed Notes flashcards trigger event with the selected note identity and content.

## Files
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/domain/noteFormatting.ts`
- `still-desktop/src/canvas.css`
- `still-desktop/src-tauri/src/shortcuts.rs`
- `still-desktop/tests/note-formatting.test.mjs`
- `still-desktop/tests/e2e/notes-formatting.spec.ts`
- Updated note related E2E tests for the contenteditable editor.

## Checks
- Focused frontend checks and tests passed: `pnpm check`; 11 note formatting and persistence unit tests.
- Chromium Playwright passed: Notes formatting, PDF citation/highlight presets, and save-selection-to-note flows (3 specs).
- `git diff --check` — passed.
- Rust test could not run because `cargo` is not installed in this Linux environment.

## Handoff
- Notes emits `still-create-flashcards` with `{widgetId,noteId,title,text}`. The stale-safe saved-deck listener and source navigation listener will be added after the flashcard contract branch is ready.

## Flashcards and editor polish follow-up
- Cherry-picked `fb6ffe6` (`agent/luna/flashcard-plugin`) and connected Notes to its save/review contract. Notes verifies the exact note text before saving a deck into the workspace snapshot, and source navigation opens the note and selects the quoted text when found.
- Checklist insertion now starts blank; Enter creates a following task item and a second Enter exits an empty task line. Literal Markdown markers typed in the editor are escaped; paste inserts plain text only.
- Added focused stale-save, note source navigation, checklist enter/exit, and literal-marker regressions.
- Checks: `pnpm check`; 31 focused tests; Chromium Notes formatting E2E passed.
