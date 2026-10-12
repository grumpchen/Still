# Task: Edge chevron controls

- Agent: Codex GPT-6
- Time: 2026-10-12T15:19:23+13:00 (Pacific/Auckland)

## Done
- Moved sidebar and widget-tray visibility chevrons from the top bar to their respective panel edges; the sidebar handle remains available when the sidebar is hidden, and the tray handle remains outside the tray while it is hidden.
- Added a focused regression assertion for edge placement and removed top-bar controls.
- Updated a stale focus-mode markup assertion so the existing workspace-controls test matches current UI.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/workspace-controls.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed (Vite production build completed).
- `pnpm.cmd exec node --test tests/workspace-controls.test.mjs` — 3 passed, 0 failed.
- `git diff --check` — passed.
- Live Windows visual acceptance — not performed.

## Handoff
- The running desktop preview should receive the changes through Vite HMR. Verify the edge placement visually in the integration session.
