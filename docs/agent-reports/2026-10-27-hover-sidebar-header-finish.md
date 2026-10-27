# Task: hover sidebar and silver headers

- Agent: Codex
- Time: 2026-10-27T19:22:05+13:00 (Pacific/Auckland)

## Done
- Changed the sidebar into an overlay that stays hidden until the pointer reaches the left edge, then slides over the workspace and retracts after the pointer leaves.
- Moved the fullscreen control into the sidebar and removed the two right-side topbar controls.
- Preserved global shortcuts, widget interactions, and the configured modifier-key right-click minimize gesture.
- Changed all widget headers to a smooth neutral silver finish with a soft pointer-following reflection.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/domain/windowInput.ts`

## Checks
- `git diff --check` — passed.
- Build and runtime checks not run.

## Handoff
- Confirm pointer reveal, sidebar leave timing, hit testing with transparent backgrounds, and header reflection in the running Windows app.
