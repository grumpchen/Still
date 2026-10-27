# Task: wave wallpaper fit

- Agent: Codex GPT-6
- Time: 2026-10-27 21:13 Pacific/Auckland (UTC+13)

## Done
- Reworked the wave wallpaper into an edge-to-edge widescreen composition and replaced the in-app image.
- Changed the backdrop from `contain` to `cover`, removing the side letterboxing. The updated wallpaper keeps a similar 16:9 ratio, so only a negligible edge amount is cropped on common desktop displays.
- The generated file is 1672×941 and contains refined metallic ridge detail; the image tool did not produce a native 4K bitmap despite the 4K request.

## Files
- `still-desktop/src/assets/wave-metal-wallpaper.png`
- `still-desktop/src/styles.css`

## Checks
- `pnpm build` — passed; Vite emitted the existing large-chunk advisory.
- `git diff --check` — passed.
- Confirmed the Still Vite development server is listening, so the changed image and CSS are available to the running preview.

## Handoff
- Select **Wave metal · still image** to see the edge-to-edge version. The image is widescreen, not native 4K; the app now fills the screen without black side gaps.
