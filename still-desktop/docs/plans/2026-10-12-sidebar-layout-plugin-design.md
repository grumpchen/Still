# Sidebar Layout Plugin Design

## Goal

Add a built-in sidebar Layout plugin that lets users snap open workspace widgets into highlighted zones using a Windows Snap style interaction.

## Decisions

- Keep Stack unchanged and add Layout as a separate optional sidebar plugin.
- Offer four zone templates: side by side, focus left, three columns, and four corners.
- Selecting a template overlays highlighted targets on the visible workspace viewport. Dragging an eligible card into a zone previews the target and snaps it on release.
- After the first widget is placed, Snap Assist offers other open widgets for the remaining zones. Selecting one fills the next empty zone; unselected widgets keep their existing placement.
- Minimized and collapsed Group cards are excluded from suggestions. Expanded Groups remain eligible. No other widgets are automatically minimized.
- Geometry is calculated in CSS pixels relative to the current viewport, translated by its scroll offset, then applied through the existing widget update path. This preserves Browser and Apps presentation synchronization.
- Layout mode is temporary; selected widget geometry persists through existing workspace state. Plugin installation/removal uses the existing sidebar plugin persistence path.

## Ownership and conflict risks

- `src/domain/snapLayouts.ts` owns template geometry, hit testing, placement, and Snap Assist assignment rules.
- `src/App.tsx` owns Layout plugin registration, persistence settings, and the temporary picker/template mode.
- `src/WorkspaceCanvas.tsx` owns drag-target selection, snapping and Snap Assist assignment. Browser and Apps continue through the current `update`/native presentation pipeline; no native window manager changes are planned.
- `src/SnapLayoutOverlay.tsx` and `src/canvas.css` own the selectable previews, target highlights, and remaining-widget choices.
- Existing Stack geometry and its Groups/minimized behavior must remain unchanged.

## Invariants

- Layout changes only the dragged or explicitly chosen widget.
- Snapped geometry always derives from the currently visible viewport and current scroll offset.
- A widget cannot occupy more than one zone, and a filled zone cannot be silently overwritten.
- Exiting layout mode leaves already-snapped placements intact.
- Existing workspace schema remains backward compatible; old states parse with no Layout plugin.

## Acceptance criteria

- A user can add/remove Layout from the sidebar plugin picker and Plugins settings, and installation persists.
- Clicking Layout shows the templates; selecting one shows highlighted zones.
- Dragging a widget into an empty zone previews and snaps it there.
- Snap Assist offers remaining eligible widgets; choosing one places it in the next empty zone.
- Minimized widgets and collapsed Groups are not suggested, while expanded Groups can be.
- Stack tests continue to pass and existing Browser/Apps widget updates stay on their established path.
- Frontend type checks, focused tests, full test suite, and frontend production build pass. Live Windows visual/native acceptance remains separate.
