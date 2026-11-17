# Task: Save AI Component results to Notes

- Agent: Codex
- Time: 2026-11-17T20:46:00+00:00 (UTC)

## Done
- Added an explicit Notes target selector after an AI Component returns a result. Saving creates a new local note; it never overwrites an existing note.
- Validated that the component and destination remain in the active workspace, the destination is a local Notes widget with capacity, and title/text limits are respected.
- Wrote the updated workspace to local storage before acknowledging success. Storage failure leaves the Notes widget unchanged and is surfaced in the component.
- Updated the Luna plan to record current implementation and remaining PDF/folder-backed Notes work.

## Files
- `still-desktop/src/domain/generatedWidgetNotes.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/GeneratedWidget.tsx`
- `still-desktop/tests/generated-widget.test.mjs`
- `still-desktop/docs/plans/2026-11-17-generated-widgets.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted the existing large-chunk warning.
- Generated-widget tests — 9 passed.
- Full `pnpm test` — 449 passed, 37 failed out of 486; same 37 failures as the base branch (`e78babf`, 440 passed / 37 failed out of 477).
- `git diff --check` — passed.
- No live API request or Windows desktop smoke test was run.

## Handoff
- PDF extraction and saving to folder-connected Notes are still outstanding. Current save creates a local note in a user-selected Notes widget.
