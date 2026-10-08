# Task: Unified widget header and Apps panel cleanup

- Agent: Codex (model not exposed in task context)
- Time: 2026-10-09T01:51:53+13:00 (Pacific/Auckland)

## Done
- Implemented from the user-tested Group baseline `8a5782836651a3530b98d05405e4ec91a0e74858` on branch `agent/codex/apps-widget-ui-cleanup`.
- Standardized the widget header layout. Browser Lecture and Apps attach/save/detach actions are in the header; Apps title editing remains inline.
- Removed Apps and Browser secondary bars so their content fills the space below the header. The Apps file chooser remains in the empty state.
- Made collapsed Groups 204 × 43 px, kept their count/name and existing collection behavior, and placed the expand control last inside the header controls. Expanded dimensions still restore from saved placement.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/BrowserWidget.tsx`
- `still-desktop/src/GroupHeaderName.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/tests/group-tray.test.mjs`
- `still-desktop/tests/unified-widget-header.test.mjs`

## Checks
- Focused Apps/Browser/Group/minimize/native regression tests: 43 passed.
- Ctrl+Shift capture regression: 1 passed.
- TypeScript check, production frontend build, offline Rust check, and `git diff --check`: passed.
- Full frontend suite: 115 passed, 6 failed in untouched baseline checks (`selected app icon bytes...`, canvas-height bound, and four inline-tray expectations). These are outside this task's changed UI and tray behavior was not modified.
- Windows release build succeeded without bundling; executable: `still-desktop/src-tauri/target/apps-ui-cleanup/release/ver0.21-test-apps-ui-cleanup-r2.exe`; SHA-256 `5B713C02DC3E2ABBDD39F053A77AF4B42CD7E651D0B433F3A6DF953A20BB4C79`.
- The executable was not launched. Build-generated permission-file line-ending changes were restored.

## Handoff
- READY TO TEST. Use the `-r2.exe` candidate for Windows acceptance. Do not merge or push before approval. Native Chrome/App visual alignment and the header appearance still need live Windows verification.
