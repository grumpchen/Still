# Task: Notes header and AI controls

- Agent: Codex (GPT-6)
- Time: 2026-11-09T00:36:29+13:00, Pacific/Auckland

## Done
- Removed the repeated note title from the editor body; local note titles can be changed from the widget header. Library-backed titles remain associated with their source paths.
- Moved Study with AI to the editor's top-right corner and made its actions collapsible, initially closed.
- Removed the Library Save button. Automatic saving and blur flush remain; the conflict reload control is unchanged.

## Files
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/styles.css`
- `docs/agent-reports/2026-11-09-notes-header-and-ai-controls.md`

## Checks
- `git diff --check` — passed.
- Automated tests and native UI verification not run.

## Handoff
- Library-backed file names are still read-only in the Notes header because renaming the backing file requires a separate grant-checked Library operation.
