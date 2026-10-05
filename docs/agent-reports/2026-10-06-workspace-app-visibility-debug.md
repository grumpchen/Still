# Task: Debug attached apps overlapping another workspace

- Agent: Codex (GPT-6), implementation and OC handoff
- Time: 2026-10-06T10:33:20+13:00 (Pacific/Auckland)

## Done
- Paused the sidebar/compact-header planning task at the user's request. No sidebar or header changes.
- Traced the ver0.19 Apps hide path: `App.tsx` keeps visited workspaces mounted but sets their surface `hidden` and passes `workspaceActive=false`. `AppsWidget.geometry()` then receives zero-sized DOM rectangles, including its resize grip. `appPanelGeometry()` previously sent that grip as `{x:0,y:0,width:0,height:0}` with `visible:false`. `app_panel_present` validates grip bounds before assigning `entry.visible`; native `Bounds.validate()` rejects dimensions below 1. The hide command therefore failed and the last visible native window remained above the new workspace.
- Reproduced the invalid hide payload with two failing frontend regressions before fixing it. Absent/zero-sized/subpixel resize grips now become `null`, which the native command already accepts. Full bounds and clip remain at least 1 x 1. Valid visible grips still provide the native corner cutout after returning to the workspace.
- Kept the ver0.19 minimum-size protections, per-instance app state, native ownership, Chrome behavior, and overlap behavior within a workspace.
- Built a new ver0.20 executable in the existing isolated worktree, copied it to the shared root without overwriting or launching any old/new release.

## Files
- `still-desktop/src/domain/appPanel.ts`
- `still-desktop/tests/app-panel.test.mjs`
- `still-desktop/README.md`
- Package/Cargo/Tauri version metadata (0.20.0)
- This report; a matching copy is provided in the shared checkout for OC discovery.
- Ignored release: `C:\Users\haoka\Projects\Default Project\ver0.20.exe`

## Checks
- Regression red: 2 failed, 7 passed in the app-panel suite; both failures showed an invalid zero-width/height grip.
- Regression green and full frontend suite: 61 passed, 0 failed (`node --test tests/*.test.mjs`).
- TypeScript: passed (`node node_modules/typescript/bin/tsc --noEmit`).
- Rust: 29 passed, 0 failed, 1 opt-in real Chrome GUI test ignored (`cargo test --offline --release --manifest-path src-tauri/Cargo.toml`). Native minimum-size and clipping/release fixtures still pass.
- Tauri production build: passed (`node node_modules/@tauri-apps/cli/tauri.js build --no-bundle -- --offline`), including TypeScript and Vite.
- Executable ProductVersion/FileVersion: 0.20.0; source and copied artifact SHA256 match.
- `git diff --check`: passed.

## Handoff
- OC: review branch `agent/codex/workspace-app-visibility` in `.worktrees/still-codex-workspace-handoff`. It is based on `00dc2e2` (ver0.19 minimum resize), with a focused visibility fix. If your checkout already incorporates those minimum changes, integrate only this task's final commit after review/required user approval. The root checkout's nine pending code changes were preserved; no merge, push, or shared history rewrite.
- User acceptance: close older Still versions; run ver0.20; attach Codex/ChatGPT in one workspace; switch to each other workspace repeatedly using both sidebar clicks and workspace hotkeys; verify those attached windows disappear, then reappear only when returning. Verify native minimum resizing and detach still work. A detached app is intentionally an ordinary desktop window and will remain visible independently of workspace switching.
- Live Codex/ChatGPT acceptance is pending. The regression proves the formerly rejected hidden geometry is now valid; native UI control is unavailable, so the screenshot's actual desktop interaction was not replayed.
- If visible windows persist after this fix, first distinguish an attached window from an intentionally detached window or newly created app popup. Record widget ID/HWND, the `app_panel_present` hide payload/error, and any later native visibility event before changing lifecycle or z-order code.
- Resume sidebar/compact-header design only after the user confirms this priority debug task is satisfactory.
