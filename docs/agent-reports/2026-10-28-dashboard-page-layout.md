# Task: Separate dashboard page from widget cards

- Agent: Codex
- Time: 2026-10-28T01:27:04+13:00 (Pacific/Auckland)

## Done
- Restyled the Dashboard as a fixed study page with a larger calendar area and supporting study modules.
- Removed floating-card borders, rounded card frames, and shadows from Dashboard modules while retaining their existing controls and content.
- Kept the Library's existing file-manager page layout with navigation rail and dedicated content area.

## Files
- `still-desktop/src/styles.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; existing large JavaScript chunk warning remains.
- `git diff --check` — passed.
- Manual Windows UI acceptance — not run.

## Handoff
- Dashboard modules still reuse existing widget content and behavior inside the fixed page layout; they do not become movable canvas widgets.
