# Task: Selectable PDF text layer

- Agent: Codex (GPT-6)
- Time: 2026-11-09T08:31:00+13:00, Pacific/Auckland

## Done
- Enabled pointer selection for PDF.js text while retaining the transparent text overlay used for exact keyword highlight geometry.
- Disabled text selection during numeric detection so number tokens and the calculation radial remain usable.
- Added a Playwright mouse-drag regression that selects the exact word `Mitochondria` from a synthetic PDF.

## Files
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/e2e/pdf-highlights.spec.ts`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd exec tsx --test tests/pdfHighlights.test.mjs` — 3 passed.
- `pnpm.cmd test:e2e:pdf` — 1 passed, including real pointer text selection and exact keyword overlay geometry.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- `git diff --check` — passed.

## Handoff
- Browser verification uses PDF.js production rendering with a synthetic text PDF. The active Tauri window is showing `design-preview.html`, so native WebView selection remains unverified.
- Scanned/image-only PDFs still need a future opt-in OCR workflow.
