# Task: Widget attachment, resize header, and Notes glass

- Agent: Codex
- Time: 2026-10-27, Pacific/Auckland

## Done
- App window discovery now falls back to the foreground window only when its full executable path matches the requested app, it is not already claimed, and the launch is not a Chrome profile-picker flow. This handles Windows handing activation to an already-running process.
- Resize preview now updates card width and height directly instead of scaling the whole card. Widget headers have a fixed 43px height.
- Removed pointer-following reflection from Notes; the body now uses a darker glass tint and the header has a more opaque satin-metal finish.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm build` — passed; existing large-chunk warning remains.
- `cargo check` — passed using the installed Cargo executable.
- No tests run. Desktop UI automation was unavailable, so native app attachment and visual appearance were not confirmed in a live Windows interaction.

## Handoff
- Please confirm opening an app from the Apps page attaches its real window into the widget. The fallback is restricted to a foreground window with an exact executable-path match.
