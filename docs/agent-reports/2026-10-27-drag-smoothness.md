# Task: drag smoothness

- Agent: Codex GPT-6
- Time: 2026-10-27T00:15:54+13:00 Pacific/Auckland

## Done
- Widget move and resize gestures now preview through direct card styling instead of updating workspace state on every pointer frame; the final placement is committed once on release.
- Preserved final positions when dropping onto another workspace or Group, and restore the original visual placement for tray saves or cancelled gestures.
- Avoided repeated local state updates when the drag feedback target has not changed.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/tests/`

## Checks
- `pnpm test` — 299 passed, 0 failed.
- Focused drag, Group, tray, and workspace-transfer tests — 44 passed, 0 failed.
- `pnpm build` — TypeScript check and production build passed.
- Live Windows drag verification was unavailable because the Still window could not be targeted by the desktop tester.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed. Recheck dragging in the live Windows app.
