# Widget Relaunch and Plugin Settings Implementation Plan

**Goal:** Add persistent global, tag-color, and per-widget relaunch policy while retaining every widget in its workspace and leaving external Apps processes under their existing lifecycle.

**Architecture:** Put policy resolution and schema normalization in the workspace domain, and keep “waiting for manual relaunch” as ephemeral startup UI state. A small built-in plugin registry will distinguish sidebar plugins from widget plugins; plugin configuration stays in workspace settings even if a plugin is disabled or removed. The optional Tag Color Status card will compose registered widget-plugin controls without owning their underlying settings.

**Tech Stack:** React 19, TypeScript, Vite, localStorage workspace schema, Node test runner, jsdom component tests.

---

## Findings and design decisions

- `App.tsx::load()` synchronously restores state, then all cards in visited workspaces are rendered. `WorkspaceCanvas.tsx` always mounts each card renderer. `BrowserWidget.tsx` opens its native Chrome panel from its mount effect, so a manual mode must gate renderer mounting rather than deleting or moving a saved widget.
- `WorkspaceCanvas.tsx` already implements an in-place Relaunch control. Ordinary views remount through a token; Browser and Apps retain their native managers and receive a relaunch token. Preserve these behaviors.
- `parseState()` currently accepts schema versions 2–4 and normalizes to version 4. `checkedWidget()` and `persistentWidgetSnapshot()` explicitly normalize/preserve fields, so the new per-widget policy must also survive collected Group restore. Keep preset creation independent so a new widget follows current global/tag policy by default.
- `sidebarPlugins` currently contains only `stack`; widget add-ons are hard-coded in `WorkspaceCanvas.tsx`. Settings currently has General, Appearance, and Plugins pages, with plugin listing inline in `App.tsx`.
- Default global mode should be Automatic for backward-compatible startup. All tag colors default to “Follow global.” Settings changes affect the next Still startup only; they must not unexpectedly remount or close running cards.
- The optional Tag Color Status feature is planned as a standalone workspace card whose selected controls are composable from the registered widget-plugin control catalog. Removing that card leaves global/per-color settings intact.
- Apps cards remain saved and can wait for manual card-view relaunch, but startup policy must not launch, reattach, detach, or close an external application. Existing native Apps behavior remains authoritative.

## Implementation tasks

### 1. Add a pure policy module and schema migration

**Files:** Create `still-desktop/src/domain/widgetRelaunch.ts`; modify `still-desktop/src/domain/workspaces.ts`; test in `still-desktop/tests/widget-relaunch-policy.test.mjs` and `still-desktop/tests/workspaces.test.mjs`.

Add global mode `automatic | manual`, per-color mode `follow | automatic | manual`, and per-widget override `follow | automatic | manual`. Implement a pure resolver with priority: relaunch plugin installed/enabled, individual override, tag-color rule, global mode. Add an “apply to all” transition that sets the global mode and clears existing individual and color overrides to `follow`, so future changes to global mode still apply uniformly. Add a schema version 5 migration with safe defaults, field validation, default-enabled Widget Relaunch plugin, and durable plugin settings. Preserve new widget override fields when collected into/restored from Groups. Keep removed/disabled plugin settings intact for later re-enable.

**Tests first:** cover all precedence branches, invalid values, apply-to-all, version 2–4 migration, round-trip persistence, collected Group preservation, and unaffected workspace IDs/order/placement/content.

### 2. Gate startup mounting without changing saved widgets

**Files:** modify `still-desktop/src/App.tsx`, `still-desktop/src/WorkspaceCanvas.tsx`, and shared widget props in `still-desktop/src/widgets.tsx`; extend `still-desktop/tests/widget-relaunch.test.mjs`.

Derive a once-per-process set of widget IDs that are waiting for manual relaunch from the loaded policy. Keep their canvas cards and persisted models rendered in place, but show a lightweight waiting view instead of mounting the widget renderer. Clicking Relaunch releases only that card from the gate; subsequent clicks use the existing in-place relaunch token. Do not recompute the current-session gate when settings are edited. On the next app start, compute it from persisted settings again. Exclude transient runtime state from localStorage. Do not change Browser/Apps native attach ownership or app shutdown behavior.

**Tests first:** with Automatic, eligible views mount on initial startup; with Manual, card and workspace remain present, renderer/native Browser does not start until clicked, and saved data/placement stay unchanged. Test individual Automatic overriding a Manual color, individual Manual overriding Automatic, and plugin-disabled forcing manual even over individual Automatic. For Apps, verify policy never calls an external app launch/attach/release command.

### 3. Separate plugin categories and add relaunch controls to Settings

**Files:** create a small built-in plugin catalog under `still-desktop/src/domain/`; modify `still-desktop/src/App.tsx`, `still-desktop/src/GeneralSettings.tsx`, and `still-desktop/src/domain/workspaces.ts`; extend `still-desktop/tests/settings-dialog.test.mjs` and add focused settings tests.

Keep Sidebar Plugins (including Stack) separate from Widget Plugins. Show Widget Relaunch enabled by default with enable, disable, remove, and restore actions. Removing it forces manual policy but keeps global/color/widget preferences saved. General Settings adds global mode and an explicit Apply to All button. Updating settings only persists policy; it does not alter currently running renderer/native lifecycle state.

**Tests first:** plugin defaults, disable/remove/re-enable retention, category display, global setting persistence, Apply to All clearing overrides, and no immediate view remount when settings change during a session.

### 4. Add the optional composable Tag Color Status card

**Files:** extend `still-desktop/src/domain/widgetCatalog.ts`, `still-desktop/src/domain/workspaces.ts`, `still-desktop/src/widgets.tsx`, and `still-desktop/src/WorkspaceCanvas.tsx`; add a focused `still-desktop/src/TagColorStatusWidget.tsx`; test in `still-desktop/tests/widget-relaunch.test.mjs` or a new `still-desktop/tests/widget-plugin-status.test.mjs`.

Register a built-in widget-plugin control for color modes and render it in an optional, user-configurable status card. Store the card’s selected control IDs on that card; store actual color-mode values in global workspace settings. Toggling a color updates only its policy. Do not override per-widget choices; show those widgets as individually overridden if the UI lists affected counts. Card deletion only deletes the card instance and its selected controls, never the underlying settings. The control catalog should accept multiple registered controls so later widget plugins can contribute controls without changing the relaunch policy module.

**Tests first:** add/remove card, configure a combination of controls, toggle a color and verify policy resolution, persist settings after card deletion, and maintain safe behavior if a saved control ID is no longer registered.

### 5. Verify regression and build

Run `pnpm --config.verifyDepsBeforeRun=false test`, `pnpm --config.verifyDepsBeforeRun=false check`, and `pnpm --config.verifyDepsBeforeRun=false build` from `still-desktop`. Existing `browser-widget-present`, `apps-widget-present`, `widget-relaunch`, workspace, group, and settings tests are required regressions. No Rust changes are planned; if implementation touches native code, add the relevant Rust tests and run `cargo test --offline -- --test-threads=1` plus the Windows release build. Do not claim live Windows GUI acceptance unless performed.

## Invariants and acceptance criteria

1. Widget IDs, workspace ownership, order, placement, minimized state, and saved content survive Manual startup and relaunch.
2. Automatic is backward-compatible default; color and individual modes inherit unless explicitly overridden.
3. Priority is plugin disabled/removed → manual; individual override → tag color → global.
4. Apply to All makes all existing widgets follow the selected global mode by clearing lower-level overrides; newly created widgets inherit normally.
5. Settings edits do not close, remount, reopen, detach, or relaunch active widgets during the current Still session.
6. Manual gating delays widget renderer startup only. It never launches an external process for an Apps card and never detaches an already-managed native window.
7. Sidebar plugins and Widget Plugins are clearly separate in Settings. Removing the optional status card does not erase any policy.
8. Existing Browser, Apps, Groups, workspace, collected-widget restore, and app shutdown behavior passes regression tests.

## Risks and ownership

- Schema ownership is centralized in `workspaces.ts`; all migration/default logic must live there rather than duplicating it in Settings components.
- Startup decision ownership belongs in App state and card gating in WorkspaceCanvas; BrowserWidget/AppsWidget should retain native side effects and should not learn global settings.
- `WidgetType` is inferred from `widgetCatalog`; adding a status card affects the widget type union, migration validation, tray/gallery choices, saved layouts, and registry renderer. Keep its initial feature limited to generic plugin controls.
- Existing tests often render WorkspaceCanvas directly. Their harness must explicitly model the default Automatic gate or pass startup-ready IDs to avoid hiding unrelated renderer tests.
- Built-in plugin registration is trusted static code only. This plan does not execute third-party code or define sandboxed plugin permissions.
