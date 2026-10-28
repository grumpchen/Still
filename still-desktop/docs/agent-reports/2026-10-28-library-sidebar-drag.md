# Library, sidebar, and canvas interaction

- Unified Library navigation across all workspaces. Each workspace now lists its file folders and Notes widgets; note widgets remain editable through the existing Notes renderer and global widget updater.
- New notes in a connected Notes library now create a Markdown file in that library root. Unconnected Notes widgets retain local note creation. Existing conflict detection and save queuing remain in place.
- Added a topbar sidebar toggle for direct hide/show control while preserving hover reveal and all keyboard shortcuts.
- Added a Dashboard-only vertical scroll container; canvas workspaces retain their independent viewport behavior.
- Widget pointer movement now applies at the next animation frame instead of waiting for the configured lower canvas frame interval. Native app-panel drag suspension and release behavior are unchanged.
- Added a feasibility assessment for AI-generated flashcard and quiz widgets; generation is not implemented.
- Verification: `pnpm check` passed. No test suite was run. Live preview was not visually inspected during this stage.
