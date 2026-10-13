# Task: fullscreen taskbar mask

- Agent: Codex
- Time: 2026-10-13 23:01 NZDT (UTC+13)

## Done
- Added a fullscreen-only opaque canvas-colored strip over the bottom edge of Still so the Windows taskbar does not bleed through the transparent window.
- Kept the mask non-interactive and scoped it to fullscreen.

## Files
- `src/App.tsx`
- `src/canvas.css`
- `tests/fullscreen.test.mjs`

## Checks
- `node --test tests/fullscreen.test.mjs` — 3 passed.
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- `git diff --check` — passed; Git reported existing line-ending normalization.

## Handoff
- Native fullscreen rendering was not available for visual acceptance in this turn; reload/restart Still and enter fullscreen to confirm the taskbar is covered on the user's display.
