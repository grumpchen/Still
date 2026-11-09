# Task: PDF preview mode switch

- Agent: Codex GPT-6
- Time: 2026-11-09T15:52:58+13:00 (Pacific/Auckland)

## Done
- Added a remembered mode switch in Files and Library PDF previews: the earlier embedded WebView PDF renderer or Still's PDF.js reader.
- Keep the Still reader mounted after first use so toggling does not reload it or lose the current page. Switching to the built-in preview carries over the current Still page number.
- Kept both modes local. Windows-associated external opening remains available through the existing external-open action.

## Files
- `still-desktop/src/PdfPreview.tsx`
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/e2e/fixtures/pdf-viewer-harness.tsx`
- `still-desktop/tests/e2e/pdf-highlights.spec.ts`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported its existing large-chunk advisory.
- `pnpm test:e2e:pdf` — passed, 4/4, including viewer switching, page carry-over, and remembered mode after remount.
- `git diff --check` — passed.
- Full `pnpm test` was stopped after the Apps widget render test took 199 seconds; the full suite result is incomplete.
- Native Still UI was not restarted or visually tested. The system mode is the prior embedded WebView PDF viewer, not the Windows-associated standalone app.

## Handoff
- Ask the user to inspect both modes in the existing Still preview. The user may use the existing external-open action to view the PDF in its Windows-associated app.
