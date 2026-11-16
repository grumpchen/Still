# Widget task status and quick filters

## Goal

Extend the existing Color Tag Status workflow so users can label workspace widgets by progress and quickly focus the canvas on unfinished work. Keep color tags and progress status as separate properties: color can represent subject or category while status represents completion.

## Backlog: first version

- Add an optional per-widget progress label: **To do**, **In progress**, or **Done**. The original request specifically names To do and Done; In progress is included as a proposed useful middle state and should remain optional in the UI if it complicates the first release.
- Show the selected status as a compact, accessible widget-header badge; preserve it through minimize/restore, workspace saves, and Groups.
- Expand the existing **Tag Color Status** widget into a status overview with counts and quick filters for To do, In progress, Done, and All.
- Keep status filtering reversible and non-destructive: filtered widgets remain in the workspace and their saved layout is not altered.
- Keep existing color-tag rules and relaunch/screenshot/clock settings intact.

## Later ideas

- Show status counts grouped by color tag.
- Support multi-select and bulk status changes.
- Let users collapse completed widgets while retaining their layout.
- Add custom status names or a Waiting/Blocked state after validating the basic workflow.
- Add optional due dates and reminders as a separate feature; this needs timezone-aware persistence and Windows notification behavior.
- Let the assistant answer questions such as “what is still To do?” only after status visibility and workspace context rules are clear.

## Design and implementation notes

- Extend `WidgetInstance` with a validated optional status and migrate old workspace data to the unset state.
- Keep status rules in a pure domain module; make the Tag Color Status widget own overview/filter controls.
- Filtering must not mutate widget positions or saved workspace contents. Provide an obvious clear-filter action.
- Use localized labels, keyboard-operable controls, and a non-color-only visual indicator.
- Check how Group collection/restoration and minimized widget badges should behave before implementation.

## Acceptance checklist

- Existing saved workspaces load with no status and retain their prior layout.
- Users can set, change, and clear status on a widget.
- Status survives save/restart, minimize/restore, workspace switching, and Group collect/restore.
- Tag Color Status shows correct counts and filters without deleting or moving widgets.
- Clearing a filter restores all widgets; color tags continue to work independently.
- English and Chinese labels and keyboard/accessibility states are present.
