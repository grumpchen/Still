# Task: Save selected Files text to a note

- Agent: Codex
- Time: 2026-11-14 UTC (exact local time unavailable)

## Done
- Added a right-click menu for selected text in the Files preview. It lists note documents in the current workspace and appends the chosen text to the selected note.
- Stopped the selected-text context menu from bubbling to the workspace canvas; browser testing found that bubbling also opened the generic Add tool menu over the save menu.
- Local notes update in workspace state. Notes-library notes flush pending edits and save through the existing revision-checked write command; write failures leave note state unchanged and return an error to Files.
- Added the behavior plan and focused tests for a selected non-active local note, a library-backed note, and a failed library write.
- Workspace layout remains unchanged.

## Files
- `src/FilesWidget.tsx`, `src/NotesWidget.tsx`, `src/WorkspaceCanvas.tsx`, `src/widgets.tsx`
- `src/canvas.css`, `src/localization.tsx`
- `tests/widget-relaunch.test.mjs`
- `tests/e2e/save-selection-to-note.spec.ts`
- `docs/plans/2026-11-14-save-selected-text-to-note.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite still reports the main app bundle size advisory.
- Focused save-to-note tests — 3 passed.
- Playwright browser suite — 28 passed, 2 unrelated assistant/library tests timed out in Cloud Chromium. The new Files-to-Notes flow passed in the full run and again after the context-menu propagation fix.
- `pnpm test` — 441 passed, 37 failed. A run on the parent commit produced the same 37 failures (438 passed), so this change introduced no additional suite failures.
- `git diff --check` — passed.

## Handoff
- No native Windows GUI run was available. Playwright exercised the web preview using a browser-selected text file; native PDF text selection and file access still need a Windows desktop check. The menu is scoped to Notes in the current workspace and limits a single selection to 12,000 characters.
