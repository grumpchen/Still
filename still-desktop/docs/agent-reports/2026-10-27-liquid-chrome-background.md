# Task: Replace leaf wallpaper with LiquidChrome

- Agent: Codex
- Time: 2026-10-27T20:03:35+13:00 (Pacific/Auckland)

## Done
- Integrated the supplied LiquidChrome WebGL component as the Liquid Glass workspace background, with restrained movement and pointer ripples that do not intercept widget input.
- Removed the leaf-photo background choice and replaced the appearance preview and settings text with LiquidChrome terminology.
- Kept transparent and dotted backgrounds and retained existing persisted appearance data compatibility.

## Files
- `still-desktop/src/LiquidChrome.tsx`
- `still-desktop/src/LiquidChrome.css`
- `still-desktop/src/App.tsx`
- `still-desktop/src/AppearanceSettings.tsx`
- `still-desktop/src/domain/appearance.ts`
- `still-desktop/src/styles.css`

## Checks
- `git diff --check` passed.
- Automated tests and build were not run.

## Handoff
- WebGL2 is needed for the animated chrome; a neutral metallic gradient remains underneath as a visual fallback.
