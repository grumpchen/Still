# Task: Liquid Glass Tag Status selects

- Agent: Codex GPT-6
- Time: 2026-10-12T15:43:19+13:00 (Pacific/Auckland)

## Done
- Added explicit readable translucent select styling for Tag Color Status controls in light Liquid Glass and a matching dark treatment for dark Liquid Glass.
- Set color-scheme explicitly so Windows/WebView select chrome and option text follow the selected theme.
- Added a focused regression test for both styles.

## Files
- `still-desktop/src/canvas.css`
- `still-desktop/tests/widget-status-appearance.test.mjs`

## Checks
- `pnpm.cmd exec node --test tests/widget-status-appearance.test.mjs` — 1 passed, 0 failed.
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed.
- `git diff --check` — passed.
- Live Windows visual acceptance — not performed.

## Handoff
- The black controls came from Tag Color Status selects retaining their canvas background and native color scheme inside Liquid Glass; verify the updated controls in the live Windows app.
