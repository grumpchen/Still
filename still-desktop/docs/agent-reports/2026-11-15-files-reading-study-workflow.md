# Task: Files reading and study workflow

- Agent: Codex, GPT-6
- Time: 2026-11-15T01:15:59+00:00

## Done
- Added editable selection-to-note saving with file/page citations, related-note lookup, reusable PDF highlight presets, reading status filters, and reviewed AI study-question drafts.
- Added a focused PDF keyword integration test using mocked extraction and provider responses.
- Kept the selected workspace layout unchanged. No live API calls or credential use.

## Files
- `src/FilesWidget.tsx`, `src/NotesWidget.tsx`, `src/PdfKeywordPreview.tsx`
- `src/domain/fileStudy.ts`, `src/domain/noteDocuments.ts`, `src/domain/workspaces.ts`
- `src/localization.tsx`, `src/canvas.css`
- `tests/file-study.test.mjs`, `tests/widget-relaunch.test.mjs`, `tests/e2e/`, `tests/fixtures/`
- `docs/plans/2026-11-15-files-reading-and-study.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reports its existing large-chunk advisory.
- Focused domain/widget tests — 9 passed, including mocked AI keyword matching and study-question saving.
- Focused Playwright flows — 2 passed: Files-to-Notes and PDF citation/preset flows. The PDF flow was run with system Chromium using a temporary config, which was removed afterward.
- `pnpm test` — 447 passed, 37 failed. The 37 failures match the count recorded on the parent baseline (438 passed, 37 failed); all new Files-focused tests passed in the full run.
- `git diff --check` — passed.
- Native Windows/Tauri build — unavailable in this environment because Rust/Cargo is not installed.

## Handoff
- AI actions require the user's configured provider and were tested with deterministic mocks; no request was sent to a live provider.
- The browser preview cannot validate native Windows file grants or native PDF extraction; those still need a desktop smoke test.
