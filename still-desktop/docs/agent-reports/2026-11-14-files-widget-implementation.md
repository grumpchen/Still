# Task: Files widget PDF highlighting

- Agent: Codex
- Time: 2026-11-14 UTC (exact local time unavailable)

## Done
- Updated only the Files widget content: the file list remains beside an opened preview, with a responsive stacked layout inside narrow widget cards.
- Added an in-app PDF renderer with red overlays aligned to selectable PDF text. It renders pages on demand and caps rendering at the first 30 pages.
- Added a natural-language instruction field. The instruction is saved locally per widget; PDF text is sent to the currently selected API provider only after the user presses Apply to PDF.
- Kept workspace geometry, other widgets, and dropped-document widget behavior unchanged.

## Files
- `src/FilesWidget.tsx`, `src/PdfKeywordPreview.tsx`, `src/canvas.css`
- `src/domain/assistantPreference.ts`, `src/domain/pdfHighlights.ts`
- `src/localization.tsx`, `package.json`, `pnpm-lock.yaml`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reports the main app bundle is above its 500 kB advisory threshold. PDF.js is dynamically imported.
- `git diff --check` — passed.
- Tests and live provider requests not run.

## Handoff
- AI highlighting requires Still desktop and a connected Gemini, OpenAI, OpenCode Go, or DeepSeek API model. Each Apply request sends up to 30 pages / 24,000 extracted characters to that provider and may use paid tokens. Image-only scanned PDFs do not have selectable text and are not OCR'd. No Windows GUI acceptance was available in this workspace.
