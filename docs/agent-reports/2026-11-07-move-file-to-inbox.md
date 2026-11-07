# Task: Move library files to Downloads Inbox

- Agent: Codex
- Time: 2026-11-07T20:52:04+13:00

## Done
- Added pointer dragging from a Files listing to the Downloads Inbox sidebar item.
- Added a native cross-root move that refuses overwrites and leaves the source intact on copy failure.
- Transfer matching notes and recent entries after a completed move.

## Files
- still-desktop/src/FilesWidget.tsx, LibraryHome.tsx, styles.css
- still-desktop/src/domain/libraryRecents.ts and src/platform/files.ts
- still-desktop/src-tauri/src/files.rs and command registration/permissions

## Checks
- pnpm check passed.
- cargo test --offline --bin still-desktop moves_to_inbox_without_overwriting_existing_files passed.
- Desktop pointer interaction not manually exercised; native webview drag interception remains a hypothesis.

## Handoff
- The existing inbox-root changes still need root-scoped notes/recent history.
