# Save selected Files text to a Note

## Goal

Let a user select readable text in the Files preview, right-click, and save it to a chosen note in the current workspace. Keep workspace geometry and existing note content intact.

## User flow

1. Select text in the Files widget's text or PDF preview.
2. Right-click to open a Still menu listing available note documents by Notes widget and note title.
3. Choose **Save to …**. Still appends the selection after a blank line, activates that note, and confirms the save.

Right-click without a text selection retains the browser's normal context menu. The selection menu is scoped to the current workspace and limits one saved selection to 12,000 characters.

## Persistence and limits

- Local Notes update their existing bounded note-document state.
- Notes-library files use the Notes widget's normal revision-checked write path. Pending edits are flushed first; stale revisions or write failures leave the selected text unsaved and report the error.
- Enforce the current per-note and total Notes text limits before mutation.
- No AI request or network connection is involved.

## Acceptance checks

- No menu for an empty selection; menu appears for selected text.
- Menu offers each note document in the current workspace.
- Saving to an inactive note appends the exact selection, activates the destination, and leaves other notes untouched.
- Saving to a library note uses its checked write path.
- Stale or unavailable destinations fail with a visible message and do not report success.

## Scope

Only the Files preview and note-save path change. Workspace positions, Files search/navigation, and other widget interactions remain unchanged.
