# Shared Notes home

- Agent · Codex
- Time · 2026-11-27T20:12:14+08:00

## Done

- Every Notes widget and the sidebar open the same Notes home. The home lists notes across workspaces, supports editing and search, and includes a Markdown history filter.
- Closing a tab or removing its workspace widget retains its note in the shared history. Explicit deletion removes the selected note from the history and its widget.
- The previous folder browser was removed from Notes. Existing Markdown links stayed available. Opening a new Markdown file saves a copy in Notes.

## Files

- Shared Notes home, Notes widget, and app state integration
- Note history and workspace persistence
- Cross-workspace browser test and note-retention regression

## Checks

- TypeScript, the frontend suite, and five targeted Playwright checks passed for the shared home and connected workflows.

## Handoff

- The history includes notes and Markdown links Still still has a record of. Older tabs removed by legacy versions may have no record to migrate.
- Publication remains on hold.
