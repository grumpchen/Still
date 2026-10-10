# Task: widget quick save

- Agent: Codex
- Time: 2026-10-11T00:20:00+13:00

## Done
- Dragging a canvas widget onto Saved + saves a reusable preset without opening the tray editor and leaves the original widget in place.
- After a new preset appears, the widget tray scrolls to its actual rightmost position so the newest preset is visible beside Saved +.
- Added a rendered-canvas regression test covering the drag, saved preset contents, visible tray entry, and end-of-row scroll position.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/tests/quick-save-drop.test.mjs`
- `still-desktop/tests/inlineTray.test.mjs`

## Checks
- `node --test tests/quick-save-drop.test.mjs tests/inlineTray.test.mjs tests/group-tray.test.mjs tests/tray-cleanup.test.mjs` — 37 passed.
- `npm run check` — passed.
- `npm run build` — passed.
- `pnpm tauri build` — frontend build passed, but replacing the existing release executable failed with Windows `Access is denied` for `src-tauri/target/release/still-desktop.exe`.

## Handoff
- Source changes are pushed to the task branch. The existing release executable could not be refreshed because Windows denied access to the output file; no executable was launched. Windows GUI acceptance was not performed.
