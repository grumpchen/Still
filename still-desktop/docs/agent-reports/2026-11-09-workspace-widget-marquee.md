# Task: workspace widget marquee selection

- Agent: Codex
- Date: 2026-11-09

## Done
- Added drag-to-select on empty workspace canvas space; selected widgets receive a visible outline.
- Dragging a selected widget header moves the movable selected widgets together and persists their updated placements. Multi-widget movement bypasses single-widget tray, snap, group, and cross-workspace drop actions.
- A click on empty canvas clears the selection. Selection listeners are removed on pointer completion/cancellation and component unmount.
- Existing Files sidebar marquee selection remains unchanged.

## Verification
- `pnpm check` — passed.
- Native Windows fixture `workspace-marquee` — passed. It selected two synthetic widgets by pointer drag, moved one selected header, and verified both positions changed by the same offset.
- Fixture used an isolated Cargo target and temporary app/WebView profile. The user's existing development process and workspace data were not touched.
- A full `pnpm test` run was attempted. An unrelated AppsWidget presentation test hit a Vite invoke timeout; the broader run stalled afterward and was stopped. The full suite is therefore not reported as passing.

## Limits
- This increment adds selection and group movement, not bulk delete or other bulk widget actions.
- It was verified with the native fixture, not with the user's currently open workspace.
