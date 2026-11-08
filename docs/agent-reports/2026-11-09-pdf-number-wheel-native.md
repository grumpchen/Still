# Task: validate PDF number wheel in native Still

- Agent: Codex (GPT-6 Luna)
- Time: 2026-11-09T09:22:00+13:00 (Pacific/Auckland)

## Done
- Fixed the PDF number detector so a sentence-ending period no longer hides a decimal such as `3.5.`; version-like `3.5.2` remains excluded as one token.
- Fixed right-click selection semantics: opening the radial menu on an already selected value now preserves the entire Ctrl selection instead of removing the clicked value.
- Extended the isolated native PDF fixture through the user-visible workflow: detect values, Ctrl-select two numbers, hold and move right mouse to the addition sector, create the Calculation widget, wait for local persistence, reload Still, and verify the saved expression and result.

## Files
- `still-desktop/src/domain/pdfCalculations.ts`
- `still-desktop/src/PdfNumberViewer.tsx`
- `still-desktop/tests/pdfCalculations.test.mjs`
- `still-desktop/tests/native/assistant-reliability.mjs`
- `still-desktop/tests/native/README.md`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; Vite emitted the existing large-chunk advisory.
- `pnpm.cmd exec tsx --test tests/pdfCalculations.test.mjs` — 6 passed.
- Native `pdf-highlights` acceptance — passed in isolated Tauri WebView. It now covers AI keyword review/apply/clear, decimal number detection, Ctrl multi-select, right-hold radial addition, persisted Calculation widget after reload, and unchanged PDF SHA-256.
- `node --check tests/native/assistant-reliability.mjs` and `git diff --check` — passed.

## Handoff
- Number extraction is based on embedded PDF text. Scanned-image OCR and a wider set of lecture-PDF layouts still need separate opt-in support and validation.
- The earlier full frontend suite reported 490/518 passing and 28 unrelated failures; it was run before this focused fix. Triage those current failures against the suite's expected product behavior.
