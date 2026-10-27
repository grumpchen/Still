# Task: Add LineWaves and wave wallpaper backgrounds

- Agent: Codex
- Time: 2026-10-27T20:09:33+13:00 (Pacific/Auckland)

## Done
- Added LineWaves as a selectable, restrained monochrome interactive background alongside LiquidChrome.
- Added the supplied wave artwork as a still-image choice; it uses contain so the artwork is not cropped.
- Saved the selected effect in the existing glass settings and defaulted older saved states to LiquidChrome.

## Files
- `still-desktop/src/LineWaves.tsx` and `still-desktop/src/LineWaves.css`
- `still-desktop/src/assets/wave-metal-wallpaper.png`
- Appearance settings and state parsing in `still-desktop/src/AppearanceSettings.tsx`, `still-desktop/src/domain/appearance.ts`, `still-desktop/src/App.tsx`, and `still-desktop/src/styles.css`
- `still-desktop/docs/plans/2026-10-27-liquid-background-effects-design.md`

## Checks
- `git diff --check` passed.
- Automated tests and build were not run.

## Handoff
- WebGL2 is needed for the animated effects. The supplied image remains available as a static option.
