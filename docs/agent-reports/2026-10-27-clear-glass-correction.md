# Task: Clear glass correction

- Agent: Codex
- Time: 2026-10-27T16:07:30+13:00 (Pacific/Auckland)

## Done
- Removed backdrop blur from Liquid Glass sidebar, widget headers, and widget interiors.
- Reduced sidebar and widget surface fills so wallpaper shows through clearly; kept the satin-metal borders and header highlights.
- Removed trailing legacy Notes rules that restored the opaque charcoal fill and blur after the newer material rules.

## Files
- `still-desktop/src/canvas.css`

## Checks
- `pnpm build` — passed; existing large-chunk advisory remains.
- `git diff --check` — passed.
- Native Still preview process is still running; CSS updates use Vite hot reload.

## Handoff
- Changes are committed locally on `agent/codex/notes-library`; not pushed.
- Reduced-transparency accessibility mode retains its solid fallback.
