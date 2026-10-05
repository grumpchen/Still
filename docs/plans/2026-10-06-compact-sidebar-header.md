# Compact Sidebar and Header Implementation Plan

**Implementation owner:** OC (OpenCode), coordinated by GPT-6 Luna. Codex provides design and acceptance criteria only. The user's integration session owns version control integration, release builds, and final testing.

**Goal:** Give the workspace more usable room through a reliable collapsed sidebar and a combined compact header, while retaining the widget tray and all existing widget interactions.

**Architecture:** Reuse `WorkspaceState.sidebarCollapsed`, the existing topbar toggle, mounted workspace surfaces, `WorkspaceCanvas` tray, and current drag targets. Merge the separate introductory section into the topbar. Keep tray shelves in normal document flow and shrink their layout; preserve saved preset/group data and native panel lifecycles.

**Tech stack:** Existing Tauri 2, React, TypeScript, CSS, and Windows native Chrome/Apps panels. No new dependencies required.

**Status:** Ready for OC implementation planning/review. This document contains proposed acceptance targets, not a claim of implementation or approval to merge/release.

---

## Scope and baseline

- Canonical repository: `C:\Users\haoka\Projects\Default Project`. All worktrees and task files stay inside that folder, following the user's workspace instruction.
- Plan source inspection used the shared checkout on 2026-10-06. Its pending app-resize changes belong to OC/other agents and must be preserved.
- The visibility fix is on `agent/codex/workspace-app-visibility`, commit `47a9ebc`, based on the minimum-size commit `00dc2e2`. See `docs/agent-reports/2026-10-06-workspace-app-visibility-debug.md`. The integration owner must establish the intended baseline and complete the live workspace-switching check before releasing this layout work.
- This plan supersedes the visual/interaction recommendations in `still-desktop/docs/plans/2026-10-05-sidebar-collapse.md` without overwriting that other agent's document. Specifically: start with immediate sidebar layout changes, keep explicit user control at narrow widths, and omit a new Ctrl+B binding.
- Existing Liquid Glass surfaces, wallpaper, widget positions/sizes, lecture mode, bookmarks/Chrome behavior, screenshot controls, files, and app attachment remain in scope for regression checks, not redesign.

## Design choice

Three options considered:

1. **Recommended: two persistent rows.** Merge workspace identity/actions into one header; retain a dedicated compact widget tray below it. Keeps drag targets visible and returns space currently used by the repeated workspace heading/subtitle.
2. **Everything in one row.** Saves another row, but creates competition between app controls, widget types, named groups and the tray removal target. Not selected.
3. **Automatically hiding the header/tray.** Offers more canvas height but reduces discoverability and changes drag-to-save/remove behavior. Not selected.

Conceptual structure (not pixel-accurate):

```text
Expanded or collapsed sidebar | [sidebar toggle] Workspace name   [Search] [Customize] [+ Add widget]
                              | [Widgets] Browser ▾ Group Calculator ▾ Notes ▾ ... CHEM111 ▾ [blank drop target]
                              | [optional inline saved widgets / group shelf]
                              | Workspace canvas — existing freely positioned widgets
```

The first two rows always remain visible. A saved shelf adds space only while open. The sidebar toggle remains in the header in both states.

## Layout specification

### 1. Sidebar

- Expanded width: retain the existing **160 CSS px**.
- Collapsed width: retain the existing **52 CSS px** rail. Collapse hides name labels, tagline, section headings, workspace number hints and profile text, without removing navigation/actions.
- Expanded navigation retains workspace names. Collapsed workspace buttons show a short name-derived badge (for example CH, MI, ST), so all workspaces are not represented by the same indistinguishable book icon. Full workspace names remain available through accessible names and tooltips. For matching initials, include the sidebar order number visibly in the badge (for example C1, C2), as well as in its tooltip/accessibility label; do not modify workspace names or IDs.
- Keep New workspace and Appearance accessible as icon buttons in the rail. Minimum target size: 32 x 32 CSS px; prefer 36 x 36 within the existing rail width.
- Active workspace uses a visible bar/outline plus an active treatment, preserving `aria-current="page"`. Do not rely solely on tint.
- Toggle uses directional appearance that communicates the next action, plus the existing dynamic accessible name, `aria-expanded`, and `aria-controls="workspace-sidebar"`. Focus stays on the toggle after switching state.
- Reuse the saved global `sidebarCollapsed` boolean. No per-workspace sidebar preferences, no new state schema, and no hover-to-expand behavior.
- Add a command-palette action labelled **Collapse sidebar** or **Expand sidebar**, both using the same state-update path as the button.
- Do not add a new keyboard shortcut in this task. Keep existing custom workspace bindings, typing shortcuts and native-app focus behavior intact.
- Initial release: change the grid width immediately. Do not translate/scale the workspace or animate the grid geometry. Small hover/background transitions may remain, with reduced-motion support. A sliding animation can be considered later after native alignment is proven.
- At narrow widths, honor the user's explicit sidebar selection. Shorten header labels instead of silently forcing rail mode while `aria-expanded` still says expanded. The native minimum width is currently 780 CSS px; also check narrower web-preview layouts.

### 2. Combined workspace header

- One **44 CSS px** row, including the existing sidebar toggle, a single workspace heading, Search, Customize/Done, and Add widget.
- Replace the duplicate `Workspace / name` breadcrumb plus large `intro` heading with one visible workspace name, using an `h1` with compact styling. Preserve the actual name; do not display the special `Your workspace.` alias instead of `Study`.
- Remove the always-visible subtitle and separate date/intro space. Remove the unused date formatting if nothing else uses it.
- Reuse the existing action handlers and search dialog; do not recreate their logic.
- At constrained widths, Search becomes an icon button; Customize can become an icon button with the correct accessible label. Add widget retains its plus and a short label where it fits. The workspace name truncates with an accessible full name/tooltip instead of forcing a second header row.
- Keep Rename, Duplicate, and Remove workspace available through the existing Customize disclosure. Make that disclosed `.workspace-tools` row compact; do not expose destructive actions permanently in the main header.
- Keep header and content horizontal padding aligned at approximately 12 CSS px, with 6–8 CSS px vertical spacing between header, tray and canvas.
- Do not add a second Add widget action to the tray or hide the existing gallery entry point.

### 3. Persistent widget tray

- Preserve the existing dedicated `widget-tray` and `tray-main-row` structure, its ref and all `data-tray-type` targets. Keep widget types and group buttons in their current order.
- Base tray height target: **44 CSS px**, including padding/border, with 30–32 CSS px button targets and a single horizontal button row.
- Reduce the static tray label to **Widgets** and remove the permanently visible two-line helper. Retain an accessible description and the existing polite live feedback during drags.
- During an existing-widget drag, use concise feedback such as **Drop to save** / **Drop to remove** alongside the current green/red target styles. Reserve a stable approximately 80 CSS px label width so changing feedback cannot change row height or move targets beneath the pointer. At narrow widths, an icon/live announcement may replace that label but its reserved width must stay stable for the current drag.
- Buttons retain their names, type icons, custom-menu arrows, and group badges. When the row overflows, scroll the buttons horizontally rather than wrapping into multiple rows. Keyboard focus must bring an offscreen button into view.
- Reserve a visibly blank **32 CSS px** non-interactive gutter at the end of the tray's main row, outside its horizontally scrolling button strip. It is inside the existing tray ref and lets users reliably reach the removal target even when the tray is full. It must not sit above a button or intercept pointer events.
- Preserve the semantics: an existing widget dropped on its matching type saves a reusable preset and keeps the open instance; dropping on blank tray space removes only that open instance; a saved button or a mismatched type does neither. External files are not deleted by dropping on blank space.
- Keep the tray in the workspace component, not a new floating or native window. Keep ordinary scrolling of the canvas separate from tray scrolling.

### 4. Expanded saved-widget and group shelves

- Preserve current disclosure state: `presetMenu` is transient per mounted canvas; `group.expanded` uses existing saved group data. Do not reset saved expanded groups on startup to meet a screenshot height target.
- Custom Browser/Files/Apps and other presets remain available through their type arrows. Group buttons still reveal group links and any widget types.
- Compact each open shelf into one inline row where space permits: section label, saved buttons, Add/Attach actions, and Collapse. Use horizontal scrolling for entry collections rather than a large wrapped block.
- Keep edit/remove-preset actions available and keyboard reachable. Keep all group actions, including Open group, Add widget/link, Edit and Remove group. Secondary group-management actions may move behind a clearly labelled **Group actions** disclosure if needed; removal must remain an explicit action.
- Place every expanded preset/group shelf in a shared in-flow shelf container below the permanent tray row. Cap that shelf container at **120 CSS px** total and scroll it vertically when multiple shelves are open. Keep each shelf's collapse control reachable, and keep the permanent widget row outside this scroll region.
- Preserve independent expansion of several groups. Do not introduce an accordion that closes another group automatically.
- Do not overlay shelves across the native Chrome/Apps content. In-flow height changes let the canvas viewport resize and native panels reposition with their existing layout machinery.
- The total tray target is <=44 CSS px closed, <=164 CSS px with shelves open. Replace the inherited `max-height:40%` limit with this shelf-specific cap so percentage sizing cannot unexpectedly clip controls. Adjust a few pixels only if focus indicators or OS scaling require it; never clip usable controls to satisfy the number.

## Existing implementation map

All paths below are relative to the assigned repository/worktree:

| File | Scoped responsibility |
|---|---|
| `still-desktop/src/App.tsx` | Combine topbar and intro, retain h1/actions, shared sidebar toggle helper and command, compact Customize disclosure |
| `still-desktop/src/canvas.css` | Canvas-specific header/sidebar/tray sizing, rail presentation, responsive overrides and shelf scroll layout |
| `still-desktop/src/styles.css` | Touch only if inherited global styles/media queries override the intended scoped layout or accessibility fallbacks |
| `still-desktop/src/WorkspaceCanvas.tsx` | Compact live tray label, permanent blank removal gutter, optional shared shelf wrapper; keep refs, hit-testing and drag providers |
| `still-desktop/src/GroupTray.tsx` | Compact shelf actions and group accessible labels without losing entries or independent disclosure state |
| `still-desktop/src/PresetTray.tsx` | Compact inline shelf presentation and reachable saved-item actions |
| `still-desktop/src/domain/workspaces.ts` | Existing sidebar state/parser only; no planned schema change |
| `still-desktop/src/BrowserWidget.tsx`, `still-desktop/src/AppsWidget.tsx` | Review observer coverage for resulting position changes; only modify if acceptance exposes a specific gap |
| `still-desktop/tests/sidebar.test.mjs`, `still-desktop/tests/trayDrop.test.mjs`, `still-desktop/tests/group-tray.test.mjs`, `still-desktop/tests/app-panel.test.mjs` | Existing persistence, drag contract, group disclosure and hidden-native-geometry regression checks |

## OC execution structure

### Task 1 — Establish baseline and implement sidebar/header

**Owner:** One scoped implementation agent, assigned by OC. Do not concurrently edit `App.tsx` or shared CSS from two worktrees without an explicit coordination decision.

1. Read `AGENTS.md`, this plan, the existing sidebar plan and the visibility debug handoff. Confirm with the integration owner which baseline includes the minimum-size and hidden-grip fixes. Preserve pending source changes.
2. Capture before measurements/screenshots at a CSS viewport of 1280 x 800 and an expanded-group example similar to the user's screenshot. Record `.topbar`, `.widget-tray` and `.canvas-viewport` rectangles.
3. Run the existing sidebar/persistence tests as the baseline. Add a meaningful behavior test or reproducible browser check for the toggle and palette action. Do not test CSS source strings or duplicate the implementation inside the test.
4. Reuse one toggle updater for button/command. Merge the intro actions/name into the existing topbar, preserving gallery/search/Customize handlers.
5. Apply scoped rail, heading and responsive CSS. Check explicit expanded state, focus and name accessibility at narrow widths.
6. Verify steps 1–6 against the header/sidebar acceptance items before moving on. Provide branch/file/check details to OC rather than building a release.

### Task 2 — Compact tray and shelves

**Owner:** Prefer the same implementer sequentially, because header, tray and CSS geometry are tightly coupled.

1. Preserve existing type/preset/group payloads and tray hit-testing. Run current tray tests before changes.
2. Compact the permanent row and helper text; add the non-interactive blank end gutter without introducing a new removal behavior.
3. Compact PresetTray/GroupTray and add the bounded shared shelf area. Preserve disclosure state and secondary actions.
4. Check every drag target while the main strip is horizontally scrolled and shelves are vertically scrolled. Hidden/offscreen buttons must not register as drop targets.
5. Run the tray, sidebar and app-panel regression suites. Check that plain blank canvas space never removes an existing widget.
6. Provide a before/after screenshot and measured height results, including both collapsed and expanded shelves.

### Task 3 — Independent review and native acceptance handoff

**Owner:** OC assigns a read-only reviewer; the integration session performs integration, release naming/builds and final live tests.

1. Review state preservation, accessible controls, CSS specificity and drag semantics. Verify no large unrelated refactor or new browser functionality.
2. Inspect observer coverage: current BrowserWidget/AppsWidget observe host/viewport resizing and mutations under `.workspace-canvas`; they do not observe the header/tray as a whole. Confirm viewport resizing schedules native presentation for sidebar and shelf changes. If a pure position change escapes those observers, add only a narrowly scoped notification/observer to the relevant layout boundary, coalesced by the existing scheduler, and test that case. Do not introduce slow polling.
3. Check native alignment and inactive-workspace isolation using the checklist below. Do not treat web-preview screenshots as proof of native window behavior.
4. Report results/remaining limitations in a task report. Give the integration session focused branch/commit details. Do not merge/push or overwrite a release based on this planning document alone.

## Acceptance criteria

### Structure and space

- At 1280 x 800 CSS px, with Customize closed and all saved shelves closed, exactly two persistent control rows remain above the canvas. The canvas starts **no more than 112 CSS px below Still's webview client top**. Exclude the Windows titlebar/taskbar from this measurement.
- Header height is about 44 CSS px and closed tray about 44 CSS px. No extra intro/date/subtitle section consumes height.
- Opening shelves grows the tray only to the shared 120 CSS px shelf limit; no inaccessible entries/actions disappear.
- At the native 780 CSS px minimum width and a narrow web preview, no header action collides, the page has no accidental horizontal overflow, and tray buttons remain reachable through their own horizontal scroll.
- Normal and Liquid Glass appearance remain readable. Long workspace/group/preset names truncate or scroll accessibly without enlarging the permanent rows.

### Sidebar and persistence

- Toggle alternates 160/52 CSS px sidebar states and remains reachable in both. Its accessible name and `aria-expanded` match what is visible.
- Collapsed workspaces are distinguishable, have full accessible names/tooltips and indicate the active item without color alone. New workspace and Appearance work from the rail.
- Mouse and keyboard activation of the toggle work; focus remains visible. The palette shows the appropriate toggle action and performs it.
- Reload/reopen restores the saved sidebar state without losing workspaces, notes, presets, groups, placements or native minimum dimensions. Missing/invalid saved booleans still default to false.
- Existing workspace hotkeys continue to work; no new binding steals a user's custom shortcut or text input.

### Tray contract

- Click/drag a base widget type to add an instance; click/drag a saved preset to add an independent instance; click a group arrow to show/hide its saved content.
- A matching main type shows green and saves; blank tray space, including the new gutter, shows red and removes only an existing open instance; no saved type or original file is deleted.
- Mismatched/saved-button drops do not become removal. Dropping files onto Files/Apps retains existing grant/shortcut behavior. Blank workspace canvas remains a move/add area.
- Keyboard users can reach saved-item Edit/Remove, group management, Collapse and Add/Attach actions after scrolling. Tab focus never lands on invisible clipped controls.
- Expanding/collapsing one group does not close another or change its saved entries. Preset editing/removal remains separate from removing an open widget instance.

### Native panels — release gate

- With real Chrome and an attached Codex/Word panel, collapse/expand the sidebar repeatedly and open/close preset/group shelves. Native windows finish aligned within **2 physical px** of their intended host bounds at 100% and 150% scale, after settling for up to 250 ms. They do not remain over the header/tray/sidebar or acquire duplicate windows.
- Toggle and shelf changes do not reset widget placements/sizes, reopen apps, detach windows or restart lecture playback. Existing partial-viewport clipping/visibility policy is preserved; this task must not introduce a new hide-on-overlap rule.
- Switch among all workspaces using both sidebar clicks and existing hotkeys, including with native-app focus. Only the active workspace's attached windows remain visible. Return restores them; the hidden-grip fix still passes.
- Resize an attached Codex card with header/corner controls after the sidebar/tray changes: its native minimum is still respected and it can expand. Lecture mode still calculates 80% from the **current visible canvas**, with correct restore behavior.
- Minimize/restore Still and detach an app: alignment/visibility stay correct; detach leaves the real app/document alive.
- Native acceptance failures block release and go back to OC with actual payload/bounds evidence. Do not conceal a geometry issue by hiding an otherwise valid active panel or by clamping all apps to a guessed size.

### Verification commands and evidence

From the assigned `still-desktop` source directory, use the installed local toolchain:

```text
pnpm test
pnpm check
pnpm build
cargo test --offline --release --manifest-path src-tauri/Cargo.toml
git diff --check
```

If the integration owner packages a Windows release, use the existing Tauri build workflow and the next agreed version; this document does not reserve or replace an executable filename. Record actual test counts, before/after CSS measurements, visual checks and native acceptance results. Preserve the ignored opt-in Chrome GUI test as opt-in; a skipped test is not proof of the live acceptance items.

## Out of scope

No app/browser replacement, widget-grid redesign, auto-rearrangement, screenshot-drag redesign, new shortcut schema, profile migration, native reparenting, wallpaper replacement, or large component refactor. No direct OC chat dispatch is claimed: this file is the durable handoff for its coordinator to read.
