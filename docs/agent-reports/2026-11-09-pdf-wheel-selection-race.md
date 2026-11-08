# Task: PDF number wheel selection reliability

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09T07:55:03+13:00 (Pacific/Auckland)

## Done
- Confirmed PDF number detection, Ctrl multi-select, right-button arithmetic wheel, and the Calculation widget already exist in this branch; corrected the earlier inaccurate status update.
- Fixed a state timing race so right-clicking an unselected number adds it to the wheel calculation before the pointer release applies the operation.
- Extracted wheel-direction and selection-limit logic into tested domain helpers.

## Files
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/src/domain/pdfCalculations.ts`
- `still-desktop/tests/pdfCalculations.test.mjs`

## Checks
- `pnpm.cmd exec tsx --test tests/pdfCalculations.test.mjs` — 5 passed.
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- `git diff --check` — passed.
- Native debug app identity was checked; actual PDF mouse interaction remains unverified because no safe PDF fixture was available in its selected Files workspace.

## Handoff
- Recognition uses embedded PDF text, not OCR for scanned pages. PDF text-overlay alignment and native right-button drag behavior still need verification against representative lecture PDFs.
