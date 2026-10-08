# Task: group header rename

- Agent: Codex
- Time: 2026-10-08T23:45:17+13:00

## Done
- Added click-to-edit Group names in the canvas widget header. Enter and blur save a trimmed name; Escape cancels. Header editing controls stop pointer propagation so they do not start a drag.
- Removed the Group name field from the embedded Group widget while retaining the field in the Group edit dialog.
- Added a domain save helper and verified linked Group cards and persisted state update with the new name.

## Files
- `still-desktop/src/GroupHeaderName.tsx`
- `still-desktop/src/GroupEditor.tsx`
- `still-desktop/src/GroupWidget.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/group-tray.test.mjs`

## Checks
- `corepack pnpm exec node --test tests/group-tray.test.mjs tests/groups.test.mjs` — passed (12 tests).
- `corepack pnpm check` — passed.
- Before changes, the complete frontend suite had 6 unrelated failures: app-picker identity, canvas height, three tray-layout assertions, and saved-app shortcut launch. The focused Group tests passed at baseline.

## Handoff
- No native panel behavior changed. Continue with actual collected-widget state and canvas Group drop targets, then the collapsed Group card design.
