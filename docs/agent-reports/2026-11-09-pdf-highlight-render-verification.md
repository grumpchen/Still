# Task: PDF keyword highlight render verification

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09T08:14:45+13:00 (Pacific/Auckland)

## Done
- Added a synthetic one-page lecture PDF and a dedicated Playwright production-preview harness using the actual PDF.js viewer and app styles.
- Verified keyword highlights render over the expected PDF text coordinates, remain after viewer remount, scale with PDF zoom, and clear locally.
- Kept the normal E2E dev-server configuration intact and added a separate `pnpm test:e2e:pdf` command because the shared Vite dev server stalled while transforming the PDF viewer.

## Files
- `still-desktop/tests/e2e/pdf-highlights.spec.ts`
- `still-desktop/tests/e2e/fixtures/pdf-viewer.html`
- `still-desktop/tests/e2e/fixtures/pdf-viewer-harness.tsx`
- `still-desktop/tests/e2e/pdf-preview-server.mjs`
- `still-desktop/tests/e2e/vite.config.ts`
- `still-desktop/playwright.pdf.config.ts`
- `still-desktop/playwright.config.ts`
- `still-desktop/package.json`

## Checks
- `pnpm test:e2e:pdf` — 1 passed; actual PDF.js canvas rendering and overlay pixels were checked in Edge.
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- `git diff --check` — passed.

## Handoff
- This verifies PDF.js production-preview rendering in Edge with a synthetic text PDF, not the Tauri native window or arbitrary lecture PDFs. Rotated text and scanned/image-only PDFs remain outside this check; OCR is not implemented.

## Follow-up: exact text geometry (2026-11-09 08:26 NZDT)
- Replaced average-character-width highlight placement with rectangles measured from PDF.js `TextLayer` DOM ranges. This uses the actual laid-out glyph positions for proportional fonts and follows PDF.js text transforms.
- Extended the PDF.js browser test to compare the applied highlight against the rendered text range within 1 CSS pixel; the test still covers persistence across viewer remount, zoom, and clear.
- `pnpm.cmd check` — passed.
- `pnpm.cmd exec tsx --test tests/pdfHighlights.test.mjs` — 3 passed.
- `pnpm.cmd test:e2e:pdf` — 1 passed, including the exact text-range geometry assertion.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- Native window inspection confirmed the active process is this checkout's debug `still-desktop.exe`, but it is showing `design-preview.html` with no PDF selected. Native Tauri PDF rendering therefore remains unverified.
