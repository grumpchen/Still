# Widget task status and quick filters

## Goal

Extend the existing Color Tag Status workflow so users can label workspace widgets by progress and quickly focus the canvas on unfinished work. Keep color tags and progress status as separate properties: color can represent subject or category while status represents completion.

Implementation is on `agent/codex/files-widget-refine`; the first version is complete and checked in the task report.

## Backlog: first version

- [x] Add optional per-widget **To do**, **In progress**, and **Done** states. Widgets start unlabeled; In progress was included as the useful middle state.
- [x] Show the selected status in an accessible, editable widget-header selector; preserve it through workspace saves and Group collect/restore.
- [x] Expand **Tag Color Status** into a status overview with counts and quick filters for To do, In progress, Done, Unlabeled, and All.
- [x] Keep filtering reversible and non-destructive. The view filter is held by each workspace canvas and does not change saved geometry; removing the last Tag Color Status widget clears it.
- [x] Keep existing color-tag rules and relaunch/screenshot/clock settings intact.

## Later ideas

- Show status counts grouped by color tag.
- Support multi-select and bulk status changes.
- Let users collapse completed widgets while retaining their layout.
- Add custom status names or a Waiting/Blocked state after validating the basic workflow.
- Add optional due dates and reminders as a separate feature; this needs timezone-aware persistence and Windows notification behavior.
- Let the assistant answer questions such as “what is still To do?” only after status visibility and workspace context rules are clear.

## Design and implementation notes

- [x] Extend `WidgetInstance` with a validated optional status. Older workspace records default to unset during parsing, so the additive field does not require a workspace schema version bump.
- [x] Keep status rules in a pure domain module; let Tag Color Status own overview/filter controls.
- [x] Keep filtering separate from saved widget positions and provide an obvious All filter and empty-result reset action.
- Use localized labels, keyboard-operable controls, and a non-color-only visual indicator.
- Check how Group collection/restoration and minimized widget badges should behave before implementation.

## Acceptance checklist

- [x] Existing workspace saves load with no status and retain their prior layout.
- [x] Users can set, change, and clear status on a widget.
- [x] Status survives serialization and Group collect/restore; minimize and workspace geometry remain intact.
- [x] Tag Color Status shows counts and filters without deleting or moving widgets.
- [x] All restores every widget; color tags work independently.
- [x] English and Chinese labels and accessible button/select states are present.
