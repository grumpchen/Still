# Task: Transparent widget interiors

- Agent: Codex
- Time: 2026-10-27T16:18:53+13:00 (Pacific/Auckland)

## Done
- Made widget interior containers fully transparent so the wallpaper shows through directly.
- Kept the metallic gradient confined to widget borders and headers; preserved pointer reflection on the Notes header.
- Kept the sidebar clear and blur-free.

## Files
- `still-desktop/src/canvas.css`

## Checks
- `pnpm build` — passed; existing large-chunk advisory remains.
- `git diff --check` — passed.
- No interaction suite run.

## Handoff
- Changes are committed locally on `agent/codex/notes-library`; not pushed.
- Reduced-transparency accessibility fallback remains available.
