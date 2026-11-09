# Task: Add a bookmarked PDF page to a study plan

## Done

- PDF page bookmarks can be dragged into a Timetable widget. The widget shows a drop target highlight and opens a draft with the file name, page, and a current-weekday default.
- The user chooses a time and saves the entry; the source PDF is not changed and no schedule is written before Save.
- Saved entries retain a validated workspace-relative PDF reference. Their “Open page” action routes through the matching Files or Notes widget and opens that page in the existing PDF viewer.
- Added English and Simplified Chinese copy, persistent-state sanitization, and drag/drop end-to-end coverage.

## Verification

- `pnpm check` — passed.
- `node --import tsx --test tests/pdfBookmarks.test.mjs tests/pdfStudyPlan.test.mjs` — 3 tests passed.
- `pnpm exec playwright test --config playwright.pdf.config.ts --grep="PDF page bookmarks|dropped into Timetable"` — 2 headless tests passed, including drop, choosing a time, saving the linked plan item, and reopening the page reference.
- `pnpm build` — passed; Vite emitted its existing large-chunk advisory.
- `git diff --check` — passed.

## Limits

- This was verified in the headless PDF/Timetable fixture. The running native Still window was not restarted or visually rechecked, and no native filesystem PDF was used in this acceptance test.
