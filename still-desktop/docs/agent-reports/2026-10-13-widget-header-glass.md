# Task: clearer sidebar-matched widget header glass

- Agent: Codex
- Time: 2026-10-13

## Done
- Applied the optional Glass widget headers setting directly to the app root so the widget-header styling follows the saved preference reliably.
- Matched widget title bars to the sidebar's exact tint, highlight, blur, and saturation values.
- Made the card transparent behind the header and kept its content backing translucent so the header samples the wallpaper like the sidebar.
- Kept header icons and controls legible and added solid fallback surfaces for reduced-transparency and forced-color modes.

## Files
- `src/App.tsx`
- `src/styles.css`

## Checks
- Live preview checked at `http://127.0.0.1:4318/design-preview.html`.
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; Vite reported its existing large-chunk advisory.
- `git diff --check` — passed.

## Handoff
- Changes remain uncommitted to preserve other in-progress Still work in this checkout.
