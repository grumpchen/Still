# Global layout undo and legacy size presets

## Changes

- Global layout Undo now records the applied target workspace and its before/after content. Undo restores only that workspace, keeps changes to all other workspaces, and refuses to overwrite later edits to the target. Appearance is restored only when it still matches the values from the applied template.
- Added `activate: false` support for layout application so background preparation can apply a workspace layout without switching the user's current workspace.
- Dashboard layout snapshots now retain module placement metadata. Saving a Dashboard layout without an explicit UI capture measures the visible Dashboard DOM when available and falls back to persisted placement/size metadata or derived grid coordinates.
- Removed the old “Preview and copy” path that created default Calendar, Focus, and Timetable widgets. Legacy size-only presets can still be selected, renamed, duplicated, and deleted. They can now be upgraded to a complete template using the current visible Dashboard modules and the preset's saved sizes; the UI explains that past content was never saved by those presets.

## Verification

- `pnpm check`: passed.
- Focused native lifecycle/global layout/domain tests: 13 passed.
- Dashboard layouts Playwright tests on Linux Chromium: 2 passed, including upgrading/applying a size-only preset and retaining its dimensions and current note content.
- `pnpm build`: passed before the last small Undo metadata adjustment; the final TypeScript check passed afterward.
- Windows runtime verification was not available in this Linux environment.
