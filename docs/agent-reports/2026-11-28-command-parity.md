# Task: Still workspace command and file-view parity

- Agent: Codex
- Time: 2026-11-28T09:25:00+08:00

## Done
- Routed workspace copying/stacking, tray shortcut renaming/removal, appearance reset and global widget relaunch policy through the same domain operations as their manual counterparts.
- Connected Files preview, navigation, search, reading status and filtering to the mounted Files widget.
- Included live workbench inspection in agent mode and generated the operation signature list for JSON-only providers from the Rust response schema.

## Files
- workspaceCommands.ts, filesViewCommands.ts, FilesWidget.tsx, assistant_protocol.rs, assistant_agent_protocol.rs and their workbench/assistant entry points.

## Checks
- TypeScript check passed. The workspace command regression checks copied content, independent widget IDs, exact shortcut targeting and refusal to stack an inactive workspace.

## Handoff
- Integrate Luna feature branches and run the full browser, unit and Windows suites before candidate sign-off.
