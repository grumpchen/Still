# Task: show full leaf wallpaper

- Agent: Codex
- Time: 2026-10-27T19:31:58+13:00 (Pacific/Auckland)

## Done
- Kept the existing leaf wallpaper asset and changed the background to `contain` so the full photo is visible without cropping.
- Removed the attempted layered zoom treatment.

## Files
- `still-desktop/src/styles.css`

## Checks
- `git diff --check` — passed.
- Build and runtime checks not run.

## Handoff
- Letterbox areas may show the dark green base color when the app window and photo aspect ratios differ.
