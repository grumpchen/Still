# Task: Choose Downloads Inbox folder

- Agent: Codex
- Time: 2026-11-07T20:31:20+13:00

## Done
- Added a native folder picker to Downloads Inbox and persist the chosen root.

## Files
- still-desktop/src/FilesWidget.tsx
- still-desktop/src/platform/files.ts
- still-desktop/src-tauri/src/files.rs
- still-desktop/src-tauri/src/main.rs

## Checks
- pnpm check and cargo check --offline passed.
- Native picker not manually verified.

## Handoff
- File notes and recents use widget-relative paths; switching the inbox root may associate an existing note or recent entry with a matching relative path in the new folder. Scope those records to the root before using this with annotated files.
