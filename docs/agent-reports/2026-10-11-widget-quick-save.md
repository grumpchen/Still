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

## Handoff
- Source changes are ready for the task branch push. Windows GUI acceptance was not performed.
