# Task: PDF number selection and calculation widgets

- Agent: Codex (GPT-6)
- Time: 2026-11-09T02:52:56+13:00 (Pacific/Auckland)

## Done
- Added an on-demand PDF number-selection mode with page navigation and debounced zoom rendering. It uses PDF text extraction; scanned image OCR is not included.
- Ctrl-click selects multiple values (up to 32). A right-button radial menu applies addition, subtraction, multiplication, or division. Selected values can also be dragged onto the workspace to create a sum calculation at the drop point.
- Added a dedicated Calculation widget, validated persisted state and tray reuse, guarded division by zero and non-finite results, and localized the new controls in English and Simplified Chinese.
- Kept the previous Files/Notes interface in place. The native preview is the expected branch process and still shows the combined Files explorer with its collapsible file list.

## Files
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/src/CalculationWidget.tsx`
- `still-desktop/src/domain/pdfCalculations.ts`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/domain/widgetCatalog.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/domain/presets.ts`
- `still-desktop/src-tauri/src/assistant_agent_protocol.rs`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/pdfCalculations.test.mjs`
- `still-desktop/tests/workspaces.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd exec tsx --test tests/pdfCalculations.test.mjs tests/workspaces.test.mjs` — 12 passed.
- `pnpm.cmd build` — passed; Vite reports the existing large-chunk advisory and emits the PDF.js worker chunk.
- `cargo check --offline` — passed with existing dead-code warnings.
- `git diff --check` — passed.
- Full `pnpm.cmd test` — one run completed with 441/491 passing and 50 failures across the wider UI/agent/workspace suite. I did not establish a clean baseline for those failures. A repeat stopped making progress in an older serial UI test after more than 90 seconds; it was stopped.
- Native Still preview — verified the branch checkout and combined Files explorer. Native PDF interaction and drag/drop remain unverified because there was no safe PDF fixture in the selected library folder.

## Handoff
- PDF.js recognizes embedded PDF text, not numbers visible only in scanned page images. Number hit boxes are estimated from PDF text-item metrics; verify alignment and drag behavior with representative lecture PDFs in the native app.
- Full-suite failures need triage against the task branch baseline before being attributed to this increment.
