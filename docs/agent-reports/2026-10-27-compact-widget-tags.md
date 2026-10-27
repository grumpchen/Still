# Task: compact-widget-tags

- Agent: Codex GPT-6
- Time: 2026-10-27T22:08:00+13:00

## Done
- Reduced the visible color tag control and dot in regular widget headers.
- Added a small color dot to minimized widgets, so a tag remains visible beside the widget icon and title.
- Preserved restore, lock, relaunch, pointer and keyboard interactions.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-chunk advisory (619.15 kB JS).
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- Continue translating the remaining AI panel, dialogs, and less-used widgets. Then complete the Notes edit preview/apply flow and remaining study workspace tools.
