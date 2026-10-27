# Task: Sidebar study utilities

- Agent: Codex
- Time: 2026-10-28T01:07:35+13:00

## Done
- Grouped sidebar study actions under a bilingual Study tools label.
- Added direct actions to open the Dashboard calendar composer and start an AI study-planning prompt from any workspace.
- Routed both actions through the fixed Dashboard before dispatching their events, so the existing calendar and Assistant handlers receive them.
- Kept Quick note, AI assistant, settings, fullscreen, and all existing keyboard shortcuts in place.
- Retained the separate fixed Dashboard study-home layout; normal workspaces continue using the movable widget canvas.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported the existing large-chunk advisory.
- `git diff --check` — passed.
- Tests and live Windows UI acceptance were not run.

## Handoff
- The sidebar remains auto-hiding and continues to expose its utility labels on hover. The Dashboard is fixed and distinct from the widget canvas. The broader study-platform objective remains in progress.
