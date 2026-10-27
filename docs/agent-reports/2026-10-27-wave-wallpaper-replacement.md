# Task: wave wallpaper replacement

- Agent: Codex GPT-6
- Time: 2026-10-27 21:04 Pacific/Auckland (UTC+13)

## Done
- Replaced the previous Wave metal wallpaper image with the user's Monochrome Flowing Wave Ridges image. Existing CSS uses `background-size: contain`, so the full image remains visible without cropping.
- The active Still development build is running and Vite rebuilt the new asset.

## Files
- `still-desktop/src/assets/wave-metal-wallpaper.png`

## Checks
- `pnpm build` — passed; Vite emitted the existing large-chunk advisory.
- `git diff --check` — passed.

## Handoff
- Select **Wave metal · still image** under Appearance → Background effect to view it.
