# Task: workspace controls v021

- Agent: OpenCode, GPT-6 Luna
- Time: 2026-10-07T11:38:43+13:00
- Task ID: `workspace_controls_v021`
- Baseline: `9bd6db1ad10d5cceb504f316b8aaf590d444fc2c`

## Done
- Added a fixed 150%-bounded canvas, frame/resize constraints, saved-layout clamping, and a non-interactive viewport overview.
- Added drag-to-transfer for one widget instance, preserving its ID/content and carrying linked Group data when needed.
- Added temporary Focus mode, an Apps `+` dialog for attach/create flows, validated saved app icons, and icon-only Apps shortcuts.
- Kept tray dropdowns inline-right with horizontal scrolling, and clipped Chrome to the viewport and higher-widget cutouts while retaining partial intersections.
- Kept implementation isolated in `.worktrees/still-opencode-workspace-controls` on `agent/opencode/workspace-controls-v021`. Generated permission-file line-ending noise was restored.

## Files
- `still-desktop/src-tauri/src/chrome_overlay.rs`
- `still-desktop/src/{App.tsx,AppsWidget.tsx,BrowserWidget.tsx,GroupTray.tsx,PresetTray.tsx,WorkspaceCanvas.tsx,canvas.css}`
- `still-desktop/src/domain/{chromeOverlay.ts,layout.ts,presets.ts,workspaces.ts}`
- `still-desktop/src/platform/chromePanel.ts`
- `still-desktop/tests/{canvas.test.mjs,chrome-overlay.test.mjs,inlineTray.test.mjs,presets.test.mjs,workspace-controls.test.mjs}`
- This report

## Checks
- `corepack pnpm test` — 93 passed, 0 failed.
- `corepack pnpm check` — passed.
- `corepack pnpm build` — passed.
- `cargo test --release` — 36 passed, 0 failed, 1 ignored (real Chrome GUI test).
- `corepack pnpm tauri build --no-bundle` — passed with an isolated Cargo target.
- `git diff --check` — passed. `cargo fmt --check` was unavailable because `rustfmt` is not installed for the active toolchain.

## Handoff
- Final candidate: `C:\Users\haoka\Projects\Default Project\.worktrees\still-opencode-workspace-controls\ver0.21-test-workspace-controls-r2.exe` (SHA-256 `c16a046dde980b838cb84272145c2190b64b71880f31d34f83c82cd8b64f0883`). The executable was not launched; the earlier non-`r2` candidate was retained rather than overwritten.
- Manual Windows acceptance remains for layout/DPI rendering, workspace-row drag transfer, Focus restoration, tray usability, and live Chrome clipping/scroll timing.
- No merge, push, release, or version acceptance performed.
