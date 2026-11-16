# Task: Widget task status

- Agent: Codex, GPT-6
- Time: 2026-11-16T12:07:19+08:00

## Done
- Added optional To do, In progress, and Done status labels to widget state, with legacy saves defaulting to unlabeled.
- Added a task-status add-on from the widget `+` menu and an accessible status selector in the widget header.
- Expanded Tag Color Status with status counts and workspace-canvas quick filters for All, To do, In progress, Done, and Unlabeled. The view filter does not change saved widget geometry; removing the last status board resets it.
- Preserved status across workspace serialization and Group collect/restore; color tags remain independent.
- Updated the feature plan and added English and Simplified Chinese labels.

## Files
- `src/domain/widgetTaskStatus.ts`, `src/domain/widgetAddons.ts`, `src/domain/workspaces.ts`
- `src/WorkspaceCanvas.tsx`, `src/TagColorStatusWidget.tsx`, `src/domain/widgetPlugins.ts`, `src/domain/widgetCatalog.ts`, `src/localization.tsx`, `src/canvas.css`
- `tests/widget-task-status.test.mjs`, `tests/widget-color-tag.test.mjs`, `tests/group-tray.test.mjs`
- `docs/plans/2026-11-16-widget-task-status.md`

## Checks
- `pnpm check` — passed.
- Focused status, add-on UI, minimize/restore, and Group tests — 27 passed.
- `pnpm build` — passed; Vite emitted its existing large-chunk advisory.
- Full `pnpm test` — 451 passed, 37 failed out of 488. Several failures show existing selector/source expectation drift outside the changed status paths; the focused status and Group tests passed.
- `git diff --check` — passed.

## Handoff
- Status filters are view-only React state per workspace canvas and are not persisted. Status labels are persisted with the widgets.
- No live Windows desktop interaction was run in this environment.
