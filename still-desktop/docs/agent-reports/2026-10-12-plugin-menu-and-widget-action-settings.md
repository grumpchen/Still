# Task: Plugin menu and widget action settings

- Agent: Codex
- Time: 2026-10-12T16:00:53+13:00 (Pacific/Auckland)

## Done
- Removed per-widget Startup behavior controls from the header `+` menu, leaving it for plugin choices.
- Removed the Workspace widget buttons heading and added icons beside Relaunch and Export PNG settings.
- Styled those two checkboxes as accessible, round toggles with a filled selected state and no checkmark.
- Preserved global/color relaunch settings and saved per-widget policies.

## Files
- `src/WorkspaceCanvas.tsx`, `src/GeneralSettings.tsx`, `src/Icon.tsx`, `src/styles.css`
- `tests/widget-color-tag.test.mjs`, `tests/app-settings.test.mjs`

## Checks
- Focused UI/widget tests: 20 passed.
- `pnpm.cmd --config.verifyDepsBeforeRun=false check`: passed.
- `pnpm.cmd --config.verifyDepsBeforeRun=false build`: passed.
- Full frontend suite: 192 passed, 1 failed. The failure is the existing `tests/inlineTray.test.mjs` assertion expecting a Focus action in GroupEditor; current GroupEditor only offers Add widget and Add link. No GroupEditor code was changed.
- No Rust or live Windows GUI checks were needed for this frontend-only change.

## Handoff
- The widget header plus menu now only contains available plugin choices. Existing relaunch policy settings remain under General/Plugins and saved policy data remains intact.
