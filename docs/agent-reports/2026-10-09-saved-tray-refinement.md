# Task: saved-tray-refinement

- Agent: Codex
- Time: 2026-10-09T11:34:35+13:00 (Pacific/Auckland)

## Done
- Moved Saved + after saved Groups and shortcuts inside the horizontal tray scroller. Edit and Trash remain fixed at the right, and saved-target hit testing respects the visible scroller area.
- Added right-click Rename/Delete menus for saved shortcuts and Groups. Renaming updates persisted names; deleting shortcuts only removes the selected saved entry. Group deletion retains its confirmation and collected-widget guard.
- Added equivalent Rename actions in the Edit dialog. No Canvas widget header, Group collection, capture, native window-management, or resize code was changed.
- Source commit: `0235be8bd1813f0600ebf5dbc87abe5d8336c9cc` on `agent/codex/saved-tray-refinement`, branched from tested baseline `0ff05e48ee8c6a97bbfce783863bcb671a4533fe`.
- Windows test build: `still-desktop/src-tauri/target/saved-tray-refinement/release/ver0.21-test-saved-tray-refinement-r2.exe` (SHA-256 `A6FFE0FC5FA3DEB9416B5E2AA024BF5182AC5AA24B87BA43E6468BD8CD408342`).

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/PresetTray.tsx`
- `still-desktop/src/GroupTray.tsx`
- `still-desktop/src/TrayEditor.tsx`
- `still-desktop/src/SavedItemContextMenu.tsx`
- `still-desktop/src/domain/trayActions.ts`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/inlineTray.test.mjs`
- `still-desktop/tests/saved-tray-actions.test.mjs`

## Checks
- Focused tray and saved-entry tests: 11 passed.
- Full frontend suite: 129 passed, 2 known baseline failures out of 131 (`selected app icon bytes...` and `canvas height...`).
- TypeScript and production frontend build passed as part of `pnpm tauri build`.
- Rust tests: 47 passed, 2 known baseline failures, 1 ignored GUI test. Failures are the existing app-minimum floor tests `c1_a_maximized_first_sample_never_becomes_the_floor` and `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted`.
- `git diff --check` passed. Windows executable built successfully; it was not launched.

## Handoff
- READY TO TEST. Please verify saved-item order and overflow, right-click menu dismissal, Rename and Delete for Widgets/Apps/Groups, and persistence after restart on Windows.
- The native Browser/App white-stripe issue remains unresolved/unverified; no native presentation or resize behavior was changed. No merge or push was performed.
