# Task: Notes drag smoothness

- Agent: Codex GPT-6
- Time: 2026-10-27T00:25:16+13:00 Pacific/Auckland

## Done
- Canvas widgets now use a compositor transform while moving or resizing; their layout dimensions and coordinates are committed after the gesture ends. This avoids repeatedly laying out text-heavy Notes content during a drag.
- Added a drag regression assertion for the Notes card transform and final committed position.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/workspace-layout.test.mjs`

## Checks
- `node --test tests/workspace-layout.test.mjs` — 8 passed, 0 failed.
- `pnpm test` — 299 passed, 0 failed.
- `pnpm build` — TypeScript check and production build passed; existing large-chunk warning remains.
- Live Windows drag verification was unavailable because the Still window could not be targeted by the desktop tester.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed. Recheck dragging a Notes card in the live Windows app.
