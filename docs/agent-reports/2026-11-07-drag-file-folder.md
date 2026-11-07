# Task: Drag files into folders

- Agent: Codex
- Time: 2026-11-07T20:44:16+13:00

## Done
- Added drag-and-drop for files onto folders within the same Files view using the native file move operation.
- Preserved file notes and recent-file paths after a successful move.

## Files
- still-desktop/src/FilesWidget.tsx
- still-desktop/src/styles.css

## Checks
- pnpm check passed. Native drag interaction not manually verified.

## Handoff
- Desktop only. Existing move operation refuses collisions and unsupported files.
