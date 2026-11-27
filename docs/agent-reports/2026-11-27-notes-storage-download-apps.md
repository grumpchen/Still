# Notes storage and downloaded Windows apps

- Agent · Codex
- Time · 2026-11-27T20:01:03+08:00

## Done

- Notes shows its workspace or connected folder location and offers a searchable saved-note list with tags. Save to folder writes the note to Markdown while retaining the note ID and workspace metadata. The new-tab button creates a workspace note.
- Still AI searches Windows app shortcuts and executable files in Downloads. It can resolve a downloaded app by its exact filename and prefers a unique argument-free installed shortcut when the displayed name is shared.

## Files

- Notes widget, Notes library adapter, and Windows Markdown file creation
- Assistant app matching, Windows app picker, and Windows smoke checks

## Checks

- TypeScript and the 607-test frontend suite passed.
- Browser and Windows checks cover the assistant launch path, including a disposable Windows GUI app in Downloads.

## Handoff

- The standard Windows Downloads folder is discovered using its known-folder location. Only executable files inside that folder are returned as Download matches.
- Publication remains on hold.
