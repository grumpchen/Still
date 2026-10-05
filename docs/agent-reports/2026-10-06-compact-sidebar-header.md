# Task: Compact sidebar and header

- Agent: MiMo V2.5 via OpenCode
- Time: 2026-10-06T11:16:15+13:00

## Done

Task 1 — sidebar and combined header:
- Reused `WorkspaceState.sidebarCollapsed` with one shared updater (`toggleSidebarCollapsed` + `sidebarToggleLabel` in `src/domain/workspaces.ts`) used by both the topbar toggle button and a new command-palette action labelled "Collapse sidebar"/"Expand sidebar". Toggle keeps focus (same DOM node), `aria-expanded`, and `aria-controls="workspace-sidebar"`. No new keyboard shortcut.
- Merged the workspace breadcrumb and large intro heading into ONE 44px topbar row: sidebar toggle, single `h1` with the real workspace name (the "Your workspace." alias is gone), Search, Customize/Done, Add widget. Removed the always-visible subtitle/date section and the now-unused `Intl.DateTimeFormat` line. Existing handlers (`setModal('commands')`, `setArrange`, `setModal('gallery')`, Rename/Duplicate/Remove via the Customize disclosure) were reused, not recreated.
- Collapsed rail keeps 52px, expanded keeps 160px. Collapsed workspace buttons now show a name-derived badge (`workspaceInitials`/`sidebarBadges` in domain): first letters of name words, or first two letters for a single word (Study → ST, Chemistry Hub → CH). Matching initials gain the 1-based sidebar order number visibly (C1, C2) and in the button tooltip/aria-label. Active workspace keeps `aria-current="page"` and gains a non-color-only `inset 3px 0 0 var(--accent)` bar. New workspace and Appearance remain icon buttons, min 36×36px in the rail.
- Narrow widths: at ≤900px Search and Customize become icon-only buttons with correct accessible labels (`aria-label="Find an action"`, `aria-label={arrange?'Done':'Customize'}`); the workspace `h1` truncates with the full name in `title`. Add widget keeps its label. Explicit expanded/collapsed sidebar state is honored (no silent rail forcing).
- Liquid Glass: added scoped `.liquid-glass .topbar-workspace-name` and `.liquid-glass .topbar-actions button` rules mirroring the previous intro-actions pill treatment, including the dark variant.

Task 2 — compact tray and shelves:
- Preserved the `widget-tray`/`tray-main-row` structure, the `tray` ref, every `data-tray-type` hit target, type order, preset arrows and group badges. `trayTarget` hit-testing and `trayDropDecision` are untouched, so the drag contract (matching type → green save + keep instance; blank tray/gutter → red remove that instance only; mismatched/saved-button → neither; external files never deleted; plain canvas never removes) is unchanged.
- Closed tray is 44px (border 2 + padding 10 + 32px button row). Buttons are 32px min-height with 4px/10px padding; the strip scrolls horizontally on overflow (`overflow-x:auto`, no wrap).
- Static label is now "Widgets"; the permanently visible two-line helper is removed. A hidden `#widget-tray-help` span carries the accessible description via `aria-describedby`, and the polite live region announces "Drop to save"/"Drop to remove"/"Not saved here" with a stable 80px reserved label width.
- Added a visibly blank 32px non-interactive gutter (`tray-blank-gutter`) at the end of the main row, outside the scrolling strip and inside the existing tray ref: `pointer-events:none`, `aria-hidden`, no `data-tray-type`, so it cannot sit above a button or intercept events; blank-space removal stays reachable when the strip is full.
- PresetTray and GroupTray render inside ONE shared in-flow `tray-shelf-area` below the permanent row, capped at 120px total with vertical scroll (replaces the inherited `max-height:40%`; the tray itself no longer hides overflow). Shelves stack in flow, so the canvas viewport resizes and existing observers see the change; shelves never overlay native Chrome/Apps content. Groups stay independently expanded (no accordion); all group actions (Edit, Open group, + Add widget, + Add link, Remove group) remain visible and explicit; preset Edit/Remove stay reachable. Entry collections scroll horizontally instead of wrapping.
- Keyboard focus on any tray/shelf button calls a shared `trayFocusIntoView` (`scrollIntoView({block:'nearest',inline:'nearest'})`), and tray-scoped focus rings use inset `outline-offset:-2px` so scroll containers never clip them.
- Geometry: closed tray 44px (2+10+32), open tray 164px (44 + 120 shelf cap, tray column gap 0 with the shelf border-top providing separation). Computed canvas-viewport top at 1280×800 CSS with Customize and shelves closed: 44 (topbar) + 8 (content padding) + 44 (tray) + 8 (canvas-system gap) = 104px, within the ≤112px target.

Tests: added two behavior tests to `tests/sidebar.test.mjs` covering the shared toggle updater/label (the exact functions both UI paths call) and the badge derivation/disambiguation. No test duplicates the implementation or asserts CSS strings.

## Files

- `still-desktop/src/App.tsx` — combined topbar, shared toggle updater + palette action, badge-aware sidebar, intro/date removal
- `still-desktop/src/domain/workspaces.ts` — `toggleSidebarCollapsed`, `sidebarToggleLabel`, `workspaceInitials`, `sidebarBadges` (no schema change)
- `still-desktop/src/canvas.css` — 44px header/tray sizing, rail badges/active bar/min targets, narrow-width header compaction, gutter/shelf-area styles, 120px shelf cap, removal of `max-height:40%`, dead intro/breadcrumb/tray-label-small cleanup
- `still-desktop/src/WorkspaceCanvas.tsx` — compact live tray label, accessible tray description, blank end gutter, shared in-flow shelf container
- `still-desktop/src/GroupTray.tsx`, `still-desktop/src/PresetTray.tsx` — focus-scroll handlers; markup/actions otherwise preserved
- `still-desktop/src/TrayDragButton.tsx` — exported `trayFocusIntoView`
- `still-desktop/tests/sidebar.test.mjs` — two new behavior tests
- `docs/plans/2026-10-06-compact-sidebar-header.md` — plan committed with Task 1

## Checks

Baseline (before changes): `corepack pnpm test` → 61 tests, 61 pass, 0 fail; `corepack pnpm check` (tsc --noEmit) → pass; `corepack pnpm build` → pass; `cargo test --offline --release --manifest-path src-tauri/Cargo.toml` (inside vcvars64 cmd environment) → 30 tests, 29 pass, 1 ignored (opt-in real-Chrome GUI test), 0 fail.

After Task 1: `pnpm test` → 63 pass, 0 fail; `pnpm check` → pass; `pnpm build` → pass.
After Task 2 (final): `pnpm test` → 63 tests, 63 pass, 0 fail, 0 skipped; `pnpm check` → pass; `pnpm build` → pass; `cargo test --offline --release` → 29 pass, 1 ignored, 0 fail; `git diff --check` → clean (exit 0).

Live browser measurement was attempted via the vite dev server (`pnpm dev`, 127.0.0.1:4318) with a same-origin 1280×800 iframe harness, but no desktop browser was connected to this session (`browser.tabs.open` returned "No desktop browser is connected"). Before/after rectangle captures and screenshots therefore remain pending; the harness file was removed and not committed. The 104px canvas-start figure above is derived from the committed CSS values, not a live capture.

## Handoff

Commits on `agent/opencode/compact-sidebar-header` (worktree `.worktrees/still-opencode-compact-sidebar`), baseline 47a9ebc:
- `03894a1` feat(workspace): compact sidebar rail and combined header (includes the plan file)
- `5939514` feat(tray): compact widget tray with shared shelf area and blank gutter

Decisions and limitations:
- No desktop browser was connected, so these acceptance items could not be verified live and need the reviewer/integration session: (1) measured `.topbar`/`.widget-tray`/`.canvas-viewport` rectangles at 1280×800 CSS (expected 44/44/104 per CSS math) and before/after screenshots; (2) toggle/palette click-through in the running app including focus retention; (3) Liquid Glass and dark-mode readability of the new topbar actions; (4) horizontal tray scrolling with focus-scroll and drop behavior while scrolled; (5) all native-panel release-gate items (alignment within 2 physical px at 100%/150% scale, workspace isolation, minimum resize, lecture mode) — untouched code paths, but still gated on live testing per the plan.
- Ambiguity resolutions (smallest choices consistent with the plan): the live drag label uses the plan's "Drop to save"/"Drop to remove" wording; external-file drags over blank tray keep the pre-existing "Not saved here" text. The tray column gap is 0 so the closed/open totals land exactly at 44/164; the shelf-area border-top + 6px padding provides the visual separation. Group secondary actions were kept inline (no new "Group actions" disclosure) because the 120px scroll area keeps them reachable with less markup change. At ≤900px both Search and Customize collapse to icon buttons; Add widget keeps its label at all widths per the plan. The narrow-width `.tray-label{display:none}` rule was removed so the reserved 80px label width stays stable during drags, per the plan.
- Pre-existing behavior preserved deliberately: shelf buttons are not `data-tray-type` targets, and an offscreen shelf button's layout rect can still influence the `overInteractive` blank-space check exactly as before this change; save targets remain protected by the existing `.tray-items` scroll-rect containment. Task 3 reviewer may re-check this against the "hidden/offscreen buttons must not register as drop targets" criterion.
- `styles.css` was not modified (no global rule overrode the scoped canvas layout; the `.lecture-app` intro rules there target markup that no longer exists in the canvas app and were left untouched as pre-existing dead CSS).
- No schema change, no new dependencies, no `.exe`/`.zip` touched, nothing merged or pushed. BrowserWidget.tsx/AppsWidget.tsx untouched; viewport resizing is in-flow so existing host/viewport observers should schedule native repositioning — reviewer Task 3 step 2 should confirm.
