# Task: Create folders in Files

- Agent: Codex
- Time: 2026-11-07T20:41:46+13:00

## Done
- Added an inline New folder form to the native Files view.
- Created folders only within the authorized current directory and registered the native command.

## Files
- still-desktop/src/FilesWidget.tsx and src/platform/files.ts
- still-desktop/src-tauri/src/files.rs and command permissions

## Checks
- pnpm check and cargo check --offline passed.
- Desktop picker and folder creation were not manually exercised.

## Handoff
- Desktop restart is required for the new native command.
