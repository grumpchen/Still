# Task: fix tutorial text clipping

- Agent: Codex
- Time: 2026-10-14T10:05:07+13:00

## Done
- Expanded the tutorial dialog so it is wider than the tutorial content and set the content to fit the available dialog width.
- Added safe word wrapping and a narrow-window rule to prevent text from being clipped.
- The running desktop app received the CSS update through Vite hot reload.

## Files
- `src/styles.css`
- `tests/getting-started-tour.test.mjs`

## Checks
- `node --test tests/getting-started-tour.test.mjs` — 3 passed.
- `pnpm check` — passed.
- Confirmed the live desktop process remained running and Vite applied the stylesheet update.

## Handoff
- The desktop development app remains open with the wider tutorial dialog.
