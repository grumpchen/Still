# Widget tray and minimize follow-up

- Task ID: `widget_tray_minimize_v021_r3`
- Baseline: `c3ebd7c579471bf6c67c85f555da11b0daf3a2e8` (`agent/opencode/workspace-controls-v021`, r2 source).
- Implementation branch: `agent/opencode/widget-tray-minimize`
- Worktree: `C:\Users\haoka\Projects\Default Project\.worktrees\still-opencode-widget-tray-minimize`
- Dependencies: build on the workspace-controls v0.21 source; do not modify the prior worktree or test executable.
- Ownership: tray in `WorkspaceCanvas.tsx`, `GroupTray.tsx`, `PresetTray.tsx`, `canvas.css`; widget state and persistence in `domain/workspaces.ts` and `App.tsx`; pointer movement/rendering/minimize/restore in `WorkspaceCanvas.tsx`; Chrome and Apps visibility in `BrowserWidget.tsx`, `AppsWidget.tsx`, `domain/chromeOverlay.ts`, `domain/appPanel.ts`, and native `src-tauri/src/chrome_overlay.rs` only if investigation proves needed; overview viewport anchoring in `WorkspaceCanvas.tsx`/`canvas.css`; regression coverage in relevant tray, layout, native visibility and new minimize tests.

## Plan

1. Restyle each existing disclosure wrapper as one pill containing its trigger, right-pointing disclosure control and inline contents. Keep current drag/drop and accessibility data attributes on their current targets. Remove detached panel borders/backgrounds while keeping the row scrollable.
2. Trace Apps shortcut icon data from saved preset through the launch/create path. Pass only `checkedAppIconData(...)` data to the new instance; keep existing fallback, title and accessible name behavior.
3. Add persisted per-widget minimized state and restore geometry. Minimize by changing the widget placement to a compact button-sized frame while retaining its prior full placement separately. Keep the original widget component mounted; hide its content visually and pass hidden/obscured state to its native panel so Chrome/Apps are hidden without release. Dragging the minimized button updates its compact placement and the saved restore position. Double-click restores at that position, clamped to workspace bounds. Keep the button on the workspace, outside the widget tray; preserve widget identity, content and group/preset entries. Update transfer, removal, duplication and old-layout parsing for minimized state.
4. Diagnose the overview map’s scroll anchoring and make the map and viewport marker update smoothly while the map stays at the visible viewport’s top-right. Avoid a full widget rerender on every scroll if a ref-based update fits existing patterns.
5. Reproduce and trace the screenshot’s white strip on the left edge of the Chrome panel during horizontal canvas scrolling. Fix the actual coordinate/clip/alignment cause; do not add a cosmetic cover or hide the browser on partial scroll. Add a regression check for the native clip geometry or placement math.
6. Add focused red-green tests for persisted minimize/restore geometry, workspace transfer and stale state handling; one-pill tray structure/scrolling; Apps icon pass-through and fallback; map anchoring; browser clip alignment. Run `corepack pnpm test`, `corepack pnpm check`, `corepack pnpm build`, and `git diff --check`; run Rust tests/build if native code changes. Build a new candidate only after stable tests, named `ver0.21-test-widget-tray-minimize-r3.exe` so accepted release numbering remains unchanged.

## Acceptance and stop point

- Every disclosure control expands its own rounded pill inline to the right; no separate shelf; one-row horizontal scrolling and all prior tray actions/drop zones remain functional.
- Apps shortcuts show the real validated icon when available and fall back cleanly otherwise; names remain available to assistive technology/tooltips.
- Every widget type minimizes to an on-canvas movable button, remains the same mounted instance, restores on double-click with prior dimensions at its new clamped location, and does not alter a saved tray/group copy. Native Apps and Chrome hide while minimized and return on restore. Workspace switching and widget transfer continue to work.
- The overview map stays at the viewport’s top-right while scrolling and marks the actual viewport and widget locations.
- The Chrome panel has no white strip along its left edge during horizontal scrolling; visible partial intersections stay aligned.
- Do not overwrite r2 or accepted release builds, launch the candidate, merge, push, or declare release acceptance. Stop at READY TO TEST with branch/commit, report, test/build results and candidate path.
