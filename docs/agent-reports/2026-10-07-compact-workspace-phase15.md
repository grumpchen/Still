# Compact Workspace Phase 1.5 — Implementation Report

**Status:** READY TO TEST
**Reported:** 2026-10-07 00:44 Pacific/Auckland
**Task:** `compact_workspace_phase15`
**Agent:** Codex

## Version control

- **Repository:** `C:\Users\haoka\Projects\Default Project`
- **Branch/worktree:** `agent/codex/compact-workspace` at `.worktrees/still-codex-compact-workspace`
- **Baseline:** `81c4d22420b376eb78f966b1ef96f0a8de31328e`, the user-tested `ver0.21-test-canvas-groups.exe` source
- **Commits:** `6ab9a1240d77f9573199dea614f5609eba2bb40a` bounds commit; `4869014` inline tray and workspace implementation
- Main, the integration branch, and existing accepted executables were not changed. Nothing was merged or pushed.

## Delivered behavior

- Every widget-type dropdown now opens immediately to the right of its arrow in the same compact tray row. Saved Groups expand next to their group buttons. Expanded controls push later tray items right, and the tray scrolls horizontally; no second shelf or dropdown row is rendered.
- Existing preset and group actions, group drag targets, multiple independently expanded groups, and the red blank-tray remove target remain in place.
- Bounded optional app-icon data is persisted for saved Groups, with safe fallbacks for invalid or over-budget images.
- The accepted canvas bounds, vertical growth, whole-Still fullscreen control, and native Chrome/Apps hide-and-resync behavior during canvas scrolling are included.
- Fullscreen Tauri permissions were added explicitly. The first build candidate did not include the required permission; it is superseded by the `-r2` test build below.

## Changed files

- `still-desktop/src-tauri/capabilities/main.json`
- `still-desktop/src/App.tsx`
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/BrowserWidget.tsx`
- `still-desktop/src/GroupTray.tsx`
- `still-desktop/src/PresetTray.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/domain/appPicker.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/platform/canvasScroll.ts`
- `still-desktop/src/widgets.tsx`
- Tests: `app-picker.test.mjs`, `canvas-scroll.test.mjs`, `fullscreen.test.mjs`, `group-tray.test.mjs`, `inlineTray.test.mjs`
- Planning/specification records under `docs/superpowers/`

## Verification

- `corepack pnpm test` — 83 passed, 0 failed.
- `corepack pnpm check` — passed (`tsc --noEmit`).
- `corepack pnpm build` — passed (Vite production build).
- `cargo test --release` — 35 passed, 0 failed, 1 ignored real-Chrome GUI test.
- Tauri native build `corepack pnpm tauri build --no-bundle` — passed with isolated Cargo target and required fullscreen permissions. The resulting executable was copied without launching.
- `git diff --check` — passed before commit; generated permission noise from the Tauri build was restored and is not part of the change.
- Test-build SHA-256: `37474E11933733778F55494624713C5E8E83A089FE084B9CCEB95EB93BA0FA1B`.

## Test build and remaining acceptance

Candidate: `C:\Users\haoka\Projects\Default Project\.worktrees\ver0.21-test-compact-workspace-r2.exe`

The app was not launched. Please test the tray row with multiple open dropdowns and limited width, confirm actions still work and horizontal scrolling reaches later items, then check fullscreen, vertical/horizontal widget bounds, and Chrome/attached-app alignment while scrolling. The automated tests cannot verify Windows rendering, DPI behavior, focus, video playback, or native window timing. The real-Chrome GUI test was intentionally ignored.

No release was accepted or created. Waiting for user Windows acceptance.
