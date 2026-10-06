# Compact workspace, group tray, fullscreen, and native-panel scrolling

**Status:** Design draft for user review. No implementation is authorized by this document.

## Goal

Make the workspace feel compact and keep its controls easy to reach while preserving movable, overlapping widgets and managed native app panels. Put the widget tray at the top of the Still client area, expand saved groups inline, support whole-app fullscreen, extend the canvas vertically, and keep every widget inside its workspace bounds.

This work is scheduled after the active wider-canvas/resize phase is accepted and before the existing Group drag/save and Apps/file phases. It is a prerequisite for those phases where their tray, group, or native-panel behavior overlaps.

## Existing architecture and constraints

- The frontend is React/TypeScript in `still-desktop/src`; Still is a Tauri 2 Windows desktop app. Chrome and attached apps are top-level native windows positioned over widget cards. They must stay separate windows; this change does not introduce `SetParent` or another embedded-browser architecture.
- `WorkspaceCanvas.tsx` owns the widget tray, scrollable viewport, widget coordinates, and move/resize gestures. `domain/layout.ts` validates and transforms placement. The canvas currently sets its width from the furthest widget and its height from the furthest widget; visible-viewport based horizontal extent and hard workspace-bound enforcement are still part of the active wider-canvas phase.
- `BrowserWidget.tsx` and `AppsWidget.tsx` schedule native window presentation on viewport scroll, resize, and layout changes. The reported horizontal-scroll drift has not been reproduced in this design task; stale or queued native geometry is a diagnosis to verify, not a confirmed root cause.
- The saved-group buttons currently render in the main tray row, while expanded group contents render in a separate shelf below it. `GroupWidgetEntry.icon` is currently a short text string. Open-app choices can provide PNG icon bytes, and `appImageUrl()` can render them, but saved group entries do not persist those image bytes today.
- The compact sidebar/header work has its own branch and acceptance history. Its branch already uses one sidebar toggle and a compact header/tray layout, but final integration state is owned by the integration session. The inspected sidebar has a single collapse/expand control and no separate workspace up/down arrows. Confirm against the accepted baseline before changing it.
- The roadmap's Phase 1 proposal preserves placements that extend beyond the minimum 130% canvas. This spec reconciles that with the new boundary request: initial canvas dimensions must include all valid saved widget bounds, while later move/resize gestures must keep the entire widget within the current canvas. New vertical placement grows the canvas before the widget would be pushed outside it.

## Interaction and layout design

### Compact top area and widget tray

- Keep the compact workspace header as the first persistent row and the widget tray directly beneath it as the second persistent row. The tray remains at the very top of the workspace client area, above the canvas, and remains visible in fullscreen.
- Reduce unnecessary spacing and labels without hiding the tray, changing widget scale, or adding a new row. The tray remains the source and target for existing add/save/remove gestures.
- Preserve type-specific preset controls and existing tray drag targets. Group expansion is a distinct interaction from preset menus.

### Group expansion and saved-widget icons

- Replace the separate below-tray group shelf with inline expansion from each group button. Expanding a group reveals its saved links/widgets to its right in the same tray row and shifts subsequent group and tray controls to the right. Collapsing returns the row to its compact form. Groups remain independently expandable; expanding one does not silently close another.
- Keep the tray horizontally scrollable when the expanded row exceeds available width. Do not wrap controls onto a second row or place expanded contents over the canvas/native windows. Keyboard focus on an expanded item scrolls it into view.
- Render saved widget entries with the corresponding widget/app icon where available. Existing text initials and legacy entries remain readable through a generic/type-icon fallback. App icons use the existing app-picker PNG source when available; saved data must be bounded and validated, and must never persist HWNDs or PIDs. The implementation plan must select a backward-compatible representation and an explicit size cap before code is changed.
- Keep entry labels and accessible names, and retain all current group actions (add/edit/remove/open) in the expanded region. Preserve current saved expansion state unless the user collapses a group.

### Whole-workspace fullscreen

- Add an explicit fullscreen toggle to Still's workspace controls. It fullscreenes the whole Still application window, not an individual widget, and leaves the header and widget tray available.
- Escape exits fullscreen. Toggling off or pressing Escape restores the windowed state and dimensions that were active before fullscreen. Fullscreen state is temporary and is not written as a persistent workspace preference.
- A viewport-size change caused by entering/exiting fullscreen must update canvas measurements and re-align visible Chrome/Apps panels through existing event-driven layout paths.

### Horizontal and vertical canvas bounds

- The usable horizontal canvas starts at no less than 130% of the visible workspace viewport width. If existing saved placements extend farther, preserve them by sizing the initial canvas to include their full bounds and padding; do not relocate or clip them on load.
- New or moved widgets cannot extend past the current canvas right or bottom edge. Resizing is clamped so the full widget frame and its resize handle stay inside those edges, while respecting the widget's catalog/native minimum size.
- The canvas grows vertically as needed when a widget is moved or resized lower, leaving a small bottom margin, and the viewport scrolls vertically to reach it. Horizontal width remains at the computed workspace extent; moving a widget to the edge does not silently expand the workspace indefinitely.
- Apply the same bound rules to pointer gestures, keyboard move/resize, tray-created widgets, and programmatic placement. Keep existing safety limits for persisted placement dimensions and coordinates.
- Preserve free overlap: widget bounds constrain movement, not collisions. Do not hide, reorder, or blank widgets because two cards overlap.

### Native Chrome/Apps during canvas scrolling

- When the workspace viewport begins horizontal or vertical scrolling, immediately hide only the external Chrome/Apps content windows; keep their Still card frames, headers, resize handles, and all ordinary widgets visible.
- Coalesce scroll/layout events. After scrolling settles, measure each native panel from its final card/content DOM rectangles, clip it to the visible viewport, present it once at the final bounds, and show it again. A scroll-end/debounced event-driven approach is preferred; do not add a polling loop.
- Do not trigger this blanking for scrolling inside a widget's own content. Do not let a queued pre-scroll presentation reveal a native window at stale coordinates after the settle presentation.
- Preserve existing overlap behavior and native-window recovery. This mechanism is specifically for viewport scrolling, not a general response to overlapping cards.
- Before implementing, reproduce the current drift on Windows and record the involved widget types, scroll direction, display scale, and whether the mismatch occurs during scrolling, after scrolling settles, or both. If the diagnosis differs, revise the mechanism while retaining the visible behavior: native content is absent during horizontal canvas scroll and correctly aligned afterward.

### Sidebar arrows

- On the accepted baseline, remove separate sidebar arrow buttons used to navigate workspaces if they exist. Preserve the single collapse/expand control and its accessible state. The inspected source currently has no separate navigation arrow buttons, so no sidebar change is required unless the accepted integration baseline differs.
- Do not remove tray disclosure arrows, group expand/collapse affordances, or widget resize controls.

## Scope and affected areas

Expected implementation files (final list to be confirmed against the accepted baseline):

| File or area | Expected responsibility |
| --- | --- |
| `still-desktop/src/App.tsx` | Fullscreen toggle/state lifecycle and header placement; preserve sidebar toggle. |
| `still-desktop/src/WorkspaceCanvas.tsx` | Canvas extent, growth/bound-aware pointer and keyboard operations, compact tray/group placement, scroll coordination hooks. |
| `still-desktop/src/GroupTray.tsx` and possibly `PresetTray.tsx` | Inline group expansion and icon rendering; retain preset menu behavior. |
| `still-desktop/src/domain/layout.ts` | Shared bounded move/resize/placement helpers and canvas extent rules. |
| `still-desktop/src/domain/workspaces.ts` | Backward-compatible saved entry icon representation only if required. |
| `still-desktop/src/BrowserWidget.tsx`, `still-desktop/src/AppsWidget.tsx` | Immediate native hide and final-geometry resync on viewport scroll. |
| `still-desktop/src/platform/chromePanel.ts`, `still-desktop/src/platform/appPanel.ts` | Reuse existing hide/present queues; only extend if ordering guarantees require it. |
| `still-desktop/src/canvas.css` | Compact top rows, horizontal inline group expansion, scrollable tray, canvas bounds presentation. |
| `still-desktop/src-tauri/src/*` | Only if Tauri fullscreen APIs are insufficient or native panel hide/show needs a minimal command; do not refactor native window ownership. |
| `still-desktop/tests/*` | Placement bounds, old-layout preservation, inline group rendering/icon fallback, fullscreen lifecycle, scroll ordering and native visibility tests. |

No file in the active Phase 1 worktree or another agent's dirty checkout may be edited. OC must create a clean feature branch/worktree from the accepted integration baseline and record its exact commit before implementation.

## Phase ordering and conflicts

1. Finish and accept the active wider-canvas/resize work, including its native panel alignment and live Windows checks.
2. Integrate/confirm the compact sidebar/header baseline that places the two persistent rows and verify which arrow controls actually remain.
3. Implement this task as **Phase 1.5 — Compact Workspace and Scroll Alignment**.
4. Only after Phase 1.5 is accepted, resume Phase 2 Group drag/save. Its assumptions must be updated to use the inline-expanded group targets and icon representation from this spec.
5. Keep Phase 3 Apps/files after Phase 2 because it shares native attachment behavior.

This task must not run concurrently with Phase 1, Phase 2, or Phase 3: it shares `WorkspaceCanvas.tsx`, `GroupTray.tsx`, `domain/layout.ts`, tray CSS, and native panel positioning. The existing Phase 2 worktree remains untouched until the new behavior is implemented and accepted.

## Acceptance criteria

- At normal and narrow supported widths, the compact header and persistent tray remain the first two workspace rows; no extra static intro row or shelf is introduced.
- Group expansion is inline and pushes later controls right; multiple groups can remain expanded; the tray scrolls horizontally instead of wrapping/overlapping the canvas.
- Saved app/widget entries show an actual app/widget icon where available and a legible fallback for missing or legacy icon data. State round-trips through save/reload with bounded data and no native handles.
- Fullscreen covers the Still workspace while retaining tray access; Escape and the toggle restore the previous windowed bounds. Fullscreen transitions keep native panels aligned.
- At an empty layout, the canvas is at least 1.3 times the visible width. Existing saved widgets beyond that extent remain visible and retain coordinates. New/moved/resized widgets stay fully inside the workspace and resize handles remain reachable.
- The canvas can extend downward as widgets are placed lower, and vertical scrolling reaches every widget without allowing a card to protrude beyond the expanded canvas.
- Overlapping widgets remain visible and overlapping remains allowed.
- On Windows, horizontal and vertical viewport scrolling blanks only managed native content while scrolling, keeps the Still widget frames visible, and restores Chrome/Apps aligned to their final positions after scrolling settles. No stale delayed update reappears at old bounds.
- Scrolling inside a widget does not hide its native panel. Workspace switching, minimize/restore, fullscreen, display scaling, and existing overlap behavior remain intact.
- Tests cover shared coordinate/bound helpers, migration/fallback for group icons, fullscreen state restoration, and scroll hide/present ordering. OC reports exact commands/results and the test executable path if built. Live Windows acceptance remains with the user's integration session.

## Explicit exclusions

- No implementation of Phase 2 group drag/save or Phase 3 Apps/file changes in this task beyond the prerequisites and layout interactions specified above.
- No widget collision avoidance, auto-arranging, or removal of overlap.
- No app-window reparenting, embedded Chrome rewrite, slow polling, or global redesign.
- No persisted fullscreen preference, changes to workspace identity/state, or destructive migration of saved layouts.
- No release build, version increment, merge, push, or automatic executable launch without integration approval.

## Risks and decisions for the implementation plan

- Native hide/show calls are asynchronous and currently serialized per panel ID. The plan must ensure that scroll bursts cannot leave a late stale `present` after the final geometry update; test that ordering explicitly.
- A widget whose native minimum exceeds the available canvas width cannot both fit inside the workspace and retain that native minimum. The implementation must expand the workspace extent enough for the minimum-sized widget rather than silently violate either constraint.
- Persisted PNG icons can enlarge local workspace data. The implementation plan must pick and test a strict per-icon and total-size limit, and preserve safe fallback behavior if an icon is invalid or exceeds the limit.
- Saved legacy placements should be preserved on load, but any item outside existing placement safety limits continues to use the current parser's validation. Do not silently clamp valid saved data to the current viewport.
- The confirmed Phase 1 baseline may change which files already contain the horizontal extent and compact header work. Reinspect that exact baseline before freezing the implementation file list.
