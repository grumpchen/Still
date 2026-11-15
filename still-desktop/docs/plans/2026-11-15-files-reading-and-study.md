# Files reading and study workflow

## Goal

Make Files useful for reviewing source documents while keeping the existing workspace layout and the original files intact. Keep local reading tools local; send document text to the configured AI provider only after the user explicitly starts an AI action.

## User flow

1. Open a PDF and enter a natural-language preference for what to find, or choose a built-in/custom highlight preset. Still asks the configured provider for exact terms and overlays matching text in red on the PDF pages.
2. Select text in a text or PDF preview, right-click, review/edit the excerpt, then save it to a workspace note. The note retains a source citation; PDF citations include a page and reopen the source at that page.
3. Optionally find related notes using local text matching, set the source file's reading status, or ask the configured provider to draft study questions and answers. Review the draft before saving it to a chosen note.
4. Use the existing per-file quick annotation for private reading notes.

## Privacy and limits

- Related-note matching runs locally and ranks note title/body terms; it does not claim semantic understanding.
- AI highlighting and question generation use the provider/model already configured in Still, only after the user presses the corresponding action. PDF extraction is bounded to 30 pages / 24,000 characters; question output is bounded and editable.
- Preview excerpts and generated drafts append through the existing Notes limits and library revision checks. Source paths must be relative and traversal-free.
- Reading statuses and custom highlight presets are bounded local preferences. Presets contain at most 12 entries; status maps at most 500 relative paths.
- Selecting preferences, saving excerpts, and using local reading tools do not move, resize, or otherwise rearrange widgets.

## Acceptance checks

- PDF highlight preference presets load/save and the chosen instruction is included in a constrained provider request. Only returned terms found in extracted text are accepted; matches render with the red PDF overlay.
- Excerpt text can be edited before saving. Notes append it without replacing prior text, retain a safe source citation, and open the cited file/page.
- Related notes rank title matches above body-only matches; unrelated notes are omitted and no provider is called.
- Reading status survives workspace serialization and filters the file list correctly.
- Study-question responses are parsed with bounds, shown as editable text, and saved to the user-selected note with a source citation.
- Failed provider/extraction/library operations report an error and do not claim that an unsaved draft was saved.
- Unit and widget tests use deterministic provider/native-command mocks; browser tests use local fixtures and do not use a real API key.
