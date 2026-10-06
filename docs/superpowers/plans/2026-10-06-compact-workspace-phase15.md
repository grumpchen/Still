# Compact Workspace Phase 1.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement the tasks sequentially. Codex owns this isolated worktree because OC reached its usage limit; do not parallelize overlapping canvas or native-panel edits.

**Goal:** On the user-tested Still Phase 1+2 baseline, compact the tray and expand every dropdown-arrow item inline, constrain widgets to a horizontal workspace that can grow vertically, add whole-Still fullscreen, and prevent native Chrome/Apps panels from drifting during canvas scroll.

**Implementation status:** All feature tasks and automated verification are complete. Final test-build handoff is ready; live Windows acceptance remains with the user.

**Architecture:** Keep the React/Tauri layout and native top-level Chrome/Apps windows. Implement shared layout bounds first, then the tray/group presentation and bounded app-icon persistence, then fullscreen and a shared scroll-state signal that serializes hide/reposition/show through existing per-panel queues.

**Tech Stack:** React 19, TypeScript 7, Tauri 2.12, Rust/Windows HWND APIs, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-compact-workspace-and-native-scroll.md`

## Task record

- **Task ID:** `compact_workspace_phase15`
- **Exact baseline:** `81c4d22420b376eb78f966b1ef96f0a8de31328e` (`agent/codex/integrate-next-features`), the source branch for the user-tested `ver0.21-test-canvas-groups.exe` candidate.
- **Implementation branch/worktree:** `agent/codex/compact-workspace` at `.worktrees/still-codex-compact-workspace`; worktree was created cleanly from the exact baseline. OC reached its usage limit; Codex is the implementation owner.
- **Dependencies:** Phase 1 wider-canvas and Phase 2 group-save are present together at the baseline and user reported the test build works. The independent Windows acceptance of this new Phase 1.5 build remains required. Phase 3 Apps/files work must wait until Phase 1.5 is ready for test/accepted.
- **Owned files:** `still-desktop/src/App.tsx`, `WorkspaceCanvas.tsx`, `GroupTray.tsx`, `PresetTray.tsx`, `BrowserWidget.tsx`, `AppsWidget.tsx`, `widgets.tsx`, `domain/layout.ts`, `domain/workspaces.ts`, `domain/appPicker.ts`, `platform/canvasScroll.ts` (new), `canvas.css`, `src-tauri/capabilities/main.json`; tests `canvas.test.mjs`, `group-tray.test.mjs`, `presets.test.mjs`, `trayDrop.test.mjs`, `app-picker.test.mjs`, `app-panel.test.mjs`, `chrome-overlay.test.mjs`, `canvas-scroll.test.mjs`, `fullscreen.test.mjs`, and `inlineTray.test.mjs`. No Rust source or dependency changes.
- **Out of ownership:** Do not modify the other OC Phase 1 worktree, group branch, shared resize-grip worktree, integration branch, `main`, or existing test executables.
- **Acceptance:** Complete all three feature tasks and checks below, build a uniquely named `ver0.21-test-compact-workspace-r2.exe` (the earlier candidate lacked the Tauri fullscreen permission and is superseded), report checks and limitations, then stop at `READY TO TEST`. Do not launch it, merge, push, or mark a release.

## Global Constraints

- Keep the compact header and persistent widget tray as the first two rows; the tray remains visible in fullscreen.
- Keep the closed tray row at its current compact 44 CSS px target; every dropdown expansion uses horizontal space in that same row rather than adding a shelf or second row.
- Preserve free overlap, existing valid saved coordinates, independent widget state, and Phase 1/2 behavior.
- Horizontal canvas width is at least `ceil(max(300, visibleViewportWidth) * 1.3)` and includes valid saved placements plus 20 CSS px margin; new gestures stay inside that computed width.
- Vertical canvas height is at least 560 CSS px and expands to include widgets plus 20 CSS px; cap new widget y coordinates at the existing 20,000 CSS px layout safety bound.
- Preserve catalog and attached-app minimum sizes; never clamp a valid saved layout merely because the current viewport is smaller.
- Group icon data is optional PNG data, validated and limited to 16 KiB per icon and 512 KiB total per workspace; HWND/PID are never persisted.
- Native panel updates are event-driven and ordered through existing per-id queues; no polling and no `SetParent`.
- Test executable name: `ver0.21-test-compact-workspace-r2.exe`; never overwrite existing artifacts or promote it to a release.
- No merge, push, release acceptance, or automatic executable launch.

## Review Focus

1. A legacy widget placed beyond the visible or 130% canvas keeps its coordinates and remains reachable after reload. Test in Task 1.
2. An attached app whose minimum size nearly fills the available width still fits wholly inside the workspace with its minimum respected. Test in Task 1 and live Windows acceptance.
3. A corrupt or oversized app icon cannot break workspace loading or exceed the per-workspace icon budget; old text icons keep rendering. Test in Task 2.
4. A delayed native `present(visible=true)` from before/during a rapid scroll cannot overtake the hide or final-position update. Test in Task 3 for both Chrome and Apps queues.
5. Escape while Chrome owns keyboard focus must not be assumed to reach Still; the fullscreen exit button stays visible/clickable above the canvas, and Escape exits when Still owns focus. Test in Task 3 and live Windows acceptance.

---

### Task 1: Bounded canvas with vertical growth

**Files:**
- Modify: `still-desktop/src/domain/layout.ts`
- Modify: `still-desktop/src/WorkspaceCanvas.tsx`
- Modify: `still-desktop/src/App.tsx` only where it creates/places widgets outside the canvas gesture path
- Test: `still-desktop/tests/canvas.test.mjs`

**Interfaces:**
- Keep `canvasExtent(viewportWidth, widgets): number` as the horizontal extent source; preserve its 130% minimum and saved-right-edge-plus-20 rule.
- Add `canvasHeight(viewportHeight: number, widgets: Array<{placement: Placement}>): number`, returning `max(560, viewportHeight, furthestWidgetBottom + 20)`.
- Add `constrainPlacement(type: WidgetType, candidate: Placement, canvasWidth: number, minimum?: {width?: number; height?: number}): Placement`. Clamp x to `[0, canvasWidth - candidate.width - 20]`; clamp resized width to the available width without crossing widget minimum; keep y within `[0, 20_000]`. Vertical extent follows the accepted placement, so it expands to contain the widget plus 20px.
- Route pointer move, pointer resize, keyboard move/resize, tray placement, and programmatic placement through the same bound rules. Keep add-at-position behavior inside the current horizontal extent; let the vertical extent grow when a valid item is placed lower.

- [x] **Step 1: Add failing layout tests**

Add tests named `canvasHeight includes every widget and a 20px trailing margin`, `constrainPlacement keeps move and resize within horizontal bounds`, `constrainPlacement respects native and catalog minimum sizes`, and `legacy saved overflow remains part of the canvas extent`. Include an attached-app minimum larger than the ordinary catalog minimum.

- [x] **Step 2: Run focused tests and confirm failures**

Run: `corepack pnpm --dir still-desktop exec node --test tests/canvas.test.mjs`
Expected: new `canvasHeight` and `constrainPlacement` assertions fail before implementation; existing extent and placement tests remain intact.

- [x] **Step 3: Implement shared extent and constraint helpers**

Implement the exact signatures above in `domain/layout.ts`. Preserve `canvasExtent`; do not calculate a moving right-edge bound from a candidate before clamping, which would make the horizontal canvas grow as the user drags toward its edge. Compute the vertical height after applying the constrained candidate so the canvas grows with a widget moved downward.

- [x] **Step 4: Apply constraints to every placement path**

In `WorkspaceCanvas.tsx` and the necessary `App.tsx` placement calls, pass current canvas width, catalog/native minimum, and candidate placement through `constrainPlacement`. Keep existing 20,000 coordinate/3,000 size parser safety limits and keep overlap allowed.

- [x] **Step 5: Run focused tests and type check**

Run: `corepack pnpm --dir still-desktop exec node --test tests/canvas.test.mjs` and `corepack pnpm --dir still-desktop check`.
Expected: all focused tests pass and TypeScript exits 0.

- [x] **Step 6: Commit**

Commit the layout helpers, placement routing, and focused tests as `fix(canvas): constrain widgets to workspace bounds`.

### Task 2: Inline tray dropdowns and saved app icons

**Files:**
- Modify: `still-desktop/src/GroupTray.tsx`
- Modify: `still-desktop/src/PresetTray.tsx`
- Modify: `still-desktop/src/WorkspaceCanvas.tsx`
- Modify: `still-desktop/src/domain/appPicker.ts`
- Modify: `still-desktop/src/domain/workspaces.ts`
- Modify: `still-desktop/src/canvas.css`
- Test: `still-desktop/tests/group-tray.test.mjs`, `still-desktop/tests/presets.test.mjs`, `still-desktop/tests/trayDrop.test.mjs`, and `still-desktop/tests/app-picker.test.mjs`

**Interfaces:**
- Extend `WidgetInstance` with optional `appIconData?: string`; extend `GroupWidgetEntry` with optional `iconData?: string` while retaining its existing `icon: string` fallback.
- Add `checkedAppIconData(value: unknown): string | undefined` in `domain/workspaces.ts`; accept only PNG data URLs whose encoded length is at most 16 KiB. The parser drops invalid/oversized optional icon data without dropping the widget/group.
- Add `groupIconBudget(groups: SavedGroup[], candidate?: GroupWidgetEntry): boolean` in `domain/workspaces.ts`; enforce a 512 KiB sum of encoded icon data per workspace when appending/saving and while parsing. Exceeding the budget saves the entry without icon data and keeps the generic fallback.
- Pass selected `AppWindowChoice.icon` bytes through the current picker attach callback to the created Apps widget; convert to a PNG data URL only after validating PNG signature/size. Do not add window/process IDs to widget state.
- `GroupTray` renders a bounded `<img>` from valid `iconData`; otherwise it renders `Icon` for the widget type and existing text icon for a custom link. Preserve aria labels and drag payload IDs.

- [x] **Step 1: Add failing persistence and rendering tests**

Add tests named `group app icons persist within size limits`, `invalid or oversized group icons fall back without dropping entries`, `workspace icon budget strips the newest over-budget icon`, `old text-only group icons still render`, and `every dropdown renders inline immediately after its button`. Assert two expanded groups can remain open, preset dropdown contents are in the same row immediately after the matching type button, later tray buttons follow expanded contents, and no lower dropdown shelf is rendered.

- [x] **Step 2: Run focused group tests and confirm failures**

Run: `corepack pnpm --dir still-desktop exec node --test tests/group-tray.test.mjs`
Expected: new icon-data and inline-order assertions fail; existing group-save/source-retention and preset action/state tests remain present.

- [x] **Step 3: Add bounded optional icon data to the schema**

Implement validation, per-entry cap, and per-workspace budget in `domain/workspaces.ts`. Maintain `version: 4`; adding optional icon fields is backward-compatible and must not trigger broad state migration. When over budget, retain the entry and its existing fallback icon.

- [x] **Step 4: Carry app icon bytes into saved Apps widgets**

In `App.tsx` and `domain/appPicker.ts`, pass the selected `AppWindowChoice.icon` bytes through the existing attach callback and store only validated bounded PNG data on the Apps widget. `AppWindowPicker.tsx` already passes the selected choice, so do not change its interface. Keep missing icons valid and use the type fallback.

- [x] **Step 5: Render group contents inline and preserve tray interactions**

Refactor `WorkspaceCanvas.tsx`, `GroupTray.tsx`, and `PresetTray.tsx` so every expanded menu renders immediately after its originating arrow button in `.tray-items`. Do not render any dropdown contents in `.tray-shelf-area`. Expanded controls push subsequent controls right and share the single compact row; the outer row scrolls horizontally without wrapping. Keep all preset editing/removal/creation/attach actions, green group save hit targets, independent group expansion, and the tray's red blank-area remove target. Update `canvas.css` without overlaying the canvas. Audit the accepted baseline sidebar: preserve its one collapse toggle; remove separate workspace arrow buttons only if any exist.

- [x] **Step 6: Run focused tests and frontend checks**

Run: `corepack pnpm --dir still-desktop exec node --test tests/group-tray.test.mjs tests/trayDrop.test.mjs tests/canvas.test.mjs` and `corepack pnpm --dir still-desktop check`.
Expected: all relevant tests pass and TypeScript exits 0.

- [x] **Step 7: Commit**

Commit group schema, icon handoff/rendering, inline expansion, and focused tests as `feat(groups): expand saved items inline with app icons`.

### Task 3: Whole-app fullscreen and scroll-safe native panels

**Files:**
- Modify: `still-desktop/src/App.tsx`
- Modify: `still-desktop/src/WorkspaceCanvas.tsx` only if a viewport hook boundary is needed
- Modify: `still-desktop/src/BrowserWidget.tsx`
- Modify: `still-desktop/src/AppsWidget.tsx`
- Create: `still-desktop/src/platform/canvasScroll.ts`
- Modify: `still-desktop/src/canvas.css`
- Test: `still-desktop/tests/chrome-overlay.test.mjs`, `still-desktop/tests/app-panel.test.mjs`, and a focused `still-desktop/tests/canvas-scroll.test.mjs`

**Interfaces:**
- Add `observeCanvasScroll(viewport: HTMLElement, onScrollingChange: (scrolling: boolean) => void, idleMs = 120): () => void` in `platform/canvasScroll.ts`. The first viewport scroll event synchronously reports `true`; native `scrollend` or the 120ms idle fallback reports `false` once. Clean up listeners/timers on unsubscribe.
- Each native widget maintains `scrolling` state in a ref. While true, every queued sync must request `visible=false`; the first true transition immediately enqueues a hide using current geometry. On false, clear cached geometry and schedule a fresh final measurement/present.
- Use Tauri `getCurrentWindow().isFullscreen()` and `setFullscreen(boolean)` to toggle the Still window. Store no persistent fullscreen state. Keep a header toggle visible above the canvas and let Escape exit fullscreen when Still's webview owns focus; do not register a global Escape hook that steals normal Chrome/video behavior.

- [x] **Step 1: Add failing scroll-state tests**

Add tests named `canvas scroll hides native surfaces immediately and restores once after settling`, `scrollend and idle fallback do not restore twice`, and `unsubscribing cancels a pending settle`. Test both the first scroll and rapid repeated scroll events with fake timers.

- [x] **Step 2: Run focused tests and confirm failures**

Run: `corepack pnpm --dir still-desktop exec node --test tests/canvas-scroll.test.mjs`
Expected: tests fail because `observeCanvasScroll` does not yet exist.

- [x] **Step 3: Implement the event-driven scroll observer**

Implement the API above in `platform/canvasScroll.ts`; use one passive viewport `scroll` listener, `scrollend` when available, and one resettable timeout fallback. Never observe `.widget-content` scrolling.

- [x] **Step 4: Integrate ordered hide/final-present behavior in Chrome and Apps**

In `BrowserWidget.tsx` and `AppsWidget.tsx`, subscribe to only `.canvas-viewport`. Invoke the existing panel command queue with `visible=false` immediately on scroll start. Make scheduled syncs respect the scrolling ref so a stale animation frame cannot re-show a panel. On settle, measure fresh bounds/clipping/grip from DOM, compare final geometry, and present according to current visibility/overlap rules. Clear queued geometry cache before the final present. Preserve close/recovery and workspace switching.

- [x] **Step 5: Add fullscreen controls and focus-aware Escape handling**

In `App.tsx`, add an accessible fullscreen toggle to `.topbar-actions` using `getCurrentWindow().isFullscreen()` and `setFullscreen(boolean)` from Tauri 2.12.1. Show/enable it only in Tauri. Toggle the native fullscreen state, handle Escape only when Still is focused and no dialog/editor should consume it, and keep the toggle visible when a native Chrome/App panel owns focus. Rely on existing ResizeObservers to remeasure; verify their callback schedules panel geometry updates.

- [x] **Step 6: Test queue ordering, focus boundaries, and frontend build**

Run: `corepack pnpm --dir still-desktop exec node --test tests/canvas-scroll.test.mjs tests/chrome-overlay.test.mjs tests/app-panel.test.mjs`; then `corepack pnpm --dir still-desktop check` and `corepack pnpm --dir still-desktop build`.
Expected: hide precedes one final fresh present per widget; no stale visible call wins; all tests, TypeScript, and Vite build pass. Manually inspect that `scrolling=true` cannot be overridden by resize/mutation observers.

- [x] **Step 7: Commit**

Commit scroll coordination, fullscreen, and focused tests as `fix(workspace): keep native panels aligned through scroll and fullscreen`.

### Task 4: Full regression and test-build handoff

**Files:**
- Modify: `docs/agent-reports/2026-10-07-compact-workspace-phase15.md` (create)
- Create a uniquely named test executable only in the agreed test-artifact location; do not add the binary to Git.

- [x] **Step 1: Run the full automated suite**

Run from `still-desktop`: `corepack pnpm test`, `corepack pnpm check`, `corepack pnpm build`, and from `still-desktop/src-tauri`: `cargo test --release`.
Expected: all frontend tests pass, TypeScript/Vite pass, and Rust tests pass except explicitly ignored GUI tests.

- [x] **Step 2: Build without launching**

Run: `corepack pnpm --dir still-desktop tauri build --no-bundle`.
Copy the resulting executable to a new `ver0.21-test-compact-workspace-r2.exe` path only after verifying that exact target does not exist. Do not change accepted release metadata or overwrite `ver0.21-test-canvas-groups.exe`.

- [x] **Step 3: Complete report and stop**

Record exact branch/HEAD, changed files, test commands/results, candidate path, scroll behavior, unresolved limitations, and Windows acceptance still needed in the agent report. Commit the report and stop at `READY TO TEST`; do not launch the executable.

## Windows acceptance checklist for the user

- Confirm inline group expansion/shrink, icons/fallbacks, tray scrolling, multiple expanded groups, and group drag-save still work.
- Enter/exit whole-app fullscreen by button and Escape; verify the tray remains available. With Chrome focused, confirm Still's visible fullscreen button works and Chrome retains its own Escape behavior.
- Move/resize widgets to horizontal bounds and down the vertical canvas; verify no card or resize handle leaves the canvas and legacy placements remain reachable.
- Scroll horizontally and vertically with Chrome and an attached app: native content disappears during scroll while Still frames stay visible, then both panels return aligned after settling. Repeat while another widget overlaps and at 100% and 150% display scale.
- Switch workspaces, minimize/restore Still, close/reopen Chrome, and confirm no stale panel appears over another workspace.

## Planning self-review

- Every spec requirement maps to Tasks 1–3; Task 4 covers regression, unique build, report, and ready-to-test handoff.
- Work was sequential because Tasks 1–3 share `WorkspaceCanvas.tsx`/`canvas.css`, and the fullscreen/native-scroll surface must be validated against the final tray and bounds geometry.
- Existing `canvasExtent` and app/group integration in commit `81c4d22` are reused; this plan does not reopen the accepted Phase 1+2 implementation.
- Optional icon data is backward-compatible and bounded per icon and workspace; invalid data only removes the picture, not the saved entry.
- The scroll observer never watches nested content, and per-id native command ordering prevents stale visibility from surviving a settled scroll.
- The plan changes no release version, dependency, app window ownership, or user data format version.
