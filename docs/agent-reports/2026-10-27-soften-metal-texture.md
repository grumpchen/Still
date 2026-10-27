# Task: soften-metal-texture

- Agent: Codex
- Time: 2026-10-27T14:12:27+13:00

## Done
- Reduced brushed-metal lines from a dense repeated pattern to sparse, low-contrast highlights on the Still mark and native icon.
- Replaced the Notes header's tight stripe pattern with a smooth satin gradient and widely spaced faint glints.
- Kept the central pane translucent and softened its dark tint.
- Regenerated the 512px PNG and multi-size Windows ICO from the SVG source.

## Files
- still-desktop/src/BrandMark.tsx
- still-desktop/src/canvas.css
- still-desktop/src-tauri/icons/icon.svg
- still-desktop/src-tauri/icons/icon.ico
- still-desktop/src-tauri/icons/icon.png

## Checks
- pnpm build — passed; existing large-bundle warning remains.
- pnpm tauri icon src-tauri/icons/icon.svg --output <temporary folder> — passed; rendered PNG inspected.
- git diff --check — passed.

## Handoff
- The Windows app icon is embedded by the desktop executable and may need a rebuild/restart to refresh in the taskbar.
