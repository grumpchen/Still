# Task: reviewable PDF keyword highlights

- Agent: Codex
- Time: 2026-11-09T03:59:43+13:00 (Pacific/Auckland)

## Done
- Added an explicit AI highlight action to the PDF.js viewer. It extracts selectable text from up to 30 pages / 24,000 characters only after the user clicks, then sends only that selected PDF text (no file path, workspace context, screenshot, or saved assistant memory) through the currently selected provider.
- The assistant is asked for a bounded JSON list of exact phrases. Still validates schema, count, length, uniqueness, and presence in the extracted text; the viewer checks the result again before presenting a review list.
- Users can uncheck suggestions, apply the remaining highlights, or discard them. Highlights are local, reversible overlays keyed by Files widget, relative file identity, and the latest PDF.js fingerprint. The source PDF is never written.
- Added English and Simplified Chinese controls and disclosure, and pure tests for phrase validation, matching across PDF.js spans, revision-specific storage, and clearing.

## Files
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/pdfHighlights.ts`
- `still-desktop/tests/pdfHighlights.test.mjs`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm check` passed.
- Focused PDF, Files, and note checks passed: 20/20.
- `pnpm build` passed; Vite reports the existing large-chunk advisory.
- `git diff --check` passed.
- Native Still preview is running from this branch, but its selected Files folder contains no PDF fixture. I did not change the user's folder selection or send their files to an AI provider. Thus this feature has not yet been exercised end-to-end in the native app.
- A temporary Node component-test attempt was removed because PDF.js's browser worker cannot resolve in Vite SSR/Node; the native WebView build includes the worker asset. Pure domain tests remain.

## Handoff
- The feature is implemented and source/build-tested, but native reader/provider acceptance is still required with a disposable PDF fixture and a synthetic provider response. Scanned, encrypted, damaged, and over-limit PDFs fail without OCR; OCR is not implemented.
- The overall Still workspace and agent robustness goal remains active.
