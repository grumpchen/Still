# Task: reflective Notes surface, placement stability, and sharper app icons

- Agent: Codex GPT-6
- Time: 2026-10-27 Pacific/Auckland

## Done
- Changed the Notes widget from pale, static glass to a darker graphite and silver reflective surface inspired by the provided reference. Its metallic highlight follows mouse and touch pointer movement.
- Made the center face substantially clearer so the workspace shows through the glass while the bevel and highlight keep the reflective metal appearance.
- Kept the Notes editor and file explorer inside the widget bounds with independently scrollable panes, reducing layout overflow when the widget is resized.
- Fixed a likely source of Notes cards jumping: placement reconciliation no longer runs after every widget-data update. It reads current widget state through refs and only re-bounds after canvas geometry or drag-state changes.
- Increased Windows app icon extraction to 256px, enlarged app-grid display, and raised the validated persistence limits so sharper icons survive saving and loading.

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reports the existing large-bundle warning.
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed using the installed Cargo executable.
- `git diff --check` — passed.
- Tests were not run. I inspected the native preview screenshot, but another window obscured much of the Notes widgets, so visual acceptance remains limited.

## Handoff
- Changes are saved on `agent/codex/notes-library`.
