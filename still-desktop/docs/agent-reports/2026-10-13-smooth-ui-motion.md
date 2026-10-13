# Task: Smooth UI motion

- Agent: Codex (GPT-6)
- Time: 2026-10-13T22:14:35+13:00

## Done
- Added eased transitions for widget position and size changes; direct pointer dragging remains immediate.
- Animated widget minimization/group collapse, saved Group tray disclosure, sidebar/tray collapse, assistant panel opening, and disclosure chevrons.
- Preserved the app-wide reduced-motion preference.

## Files
- `src/canvas.css`
- `src/assistant.css`
- `src/AssistantPanel.tsx`
- `src/App.tsx`
- `src/WorkspaceCanvas.tsx`
- `src/GroupTray.tsx`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; Vite reported the existing large-chunk advisory.
- `node --test tests/workspace-layout.test.mjs` — 6 passed.
- Combined canvas/workspace test run — 20 passed, 2 unrelated existing fixture/migration failures in `tests/canvas.test.mjs`.
- `git diff --check` — passed.

## Handoff
- Visual acceptance in the live Windows app remains useful to tune perceived timing. The shared task branch already contains unrelated pending feature changes, so this focused change remains uncommitted to avoid bundling them.
