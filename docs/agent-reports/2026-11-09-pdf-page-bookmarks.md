# Task: PDF page bookmarks

- Agent: Codex GPT-6
- Time: 2026-11-09T14:41:43+13:00

## Done
- Added a PDF toolbar control to bookmark or unbookmark the current page, plus a menu to jump to or remove saved page bookmarks.
- Bookmarks are stored locally and keyed by widget, relative file path, and PDF fingerprint. They survive viewer remounts and remain isolated across files and PDF revisions.
- Added English and Simplified Chinese labels and validation for malformed, duplicate, stale, or excessive bookmark data.

## Files
- `still-desktop/src/domain/pdfBookmarks.ts`
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/pdfBookmarks.test.mjs`
- `still-desktop/tests/e2e/pdf-highlights.spec.ts`

## Checks
- `pnpm check` — passed.
- `node --import tsx --test tests/pdfBookmarks.test.mjs` — passed.
- `pnpm exec playwright test --config playwright.pdf.config.ts --grep="PDF page bookmarks"` — passed; verifies save, jump, restore after remount, and removal in the headless PDF viewer fixture.
- Existing PDF keyword-highlight Playwright test — passed.
- `pnpm build` and `git diff --check` — passed; Vite reported its existing large-chunk advisory.
- No native Still window was restarted or changed; native visual acceptance remains for the user to inspect.

## Handoff
- Bookmark labels are the page number only; custom names are not included. Data stays on this device and does not alter the PDF.
