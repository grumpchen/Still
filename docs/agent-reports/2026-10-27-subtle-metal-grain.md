# Task: subtle metal grain

- Agent: Codex
- Time: 2026-10-27T19:24:27+13:00 (Pacific/Auckland)

## Done
- Added a very low-opacity, fine-grain overlay to widget headers for a slight metallic surface texture.
- Kept the pointer reflection and edge highlights; disabled the grain in forced-colors mode.

## Files
- `still-desktop/src/canvas.css`

## Checks
- `git diff --check` — passed.
- Build and runtime checks not run.

## Handoff
- Confirm grain strength on the running Windows app; adjust opacity if the texture is too noticeable.
