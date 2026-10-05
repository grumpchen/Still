# Task: Complete attached-app minimum-size resizing

- Agent: Codex (GPT-6), continuing OpenCode GPT-6 Luna's unfinished work
- Time: 2026-10-06T00:04:31+13:00 (Pacific/Auckland)

## Done
- Copied Luna's nine pending resize-related file changes into the existing isolated worktree and continued them on `agent/codex/app-minimum-resize`. The shared OpenCode checkout and its pending changes were preserved.
- Read native minimum tracking dimensions through a bounded `WM_GETMINMAXINFO` request when a panel is attached/shown or its DPI scale changes. Clamp native positioning to those dimensions and retain Luna's observed-size fallback for unsupported queries or apps with stricter limits.
- Apply the minimum plus Still's header/toolbar/footer to both pointer and keyboard widget resizing. Persist valid limits for reopening; clear them when changing the app and stop enforcing them when detached.
- Fixed stale position replies growing a widget back to an earlier requested size. The frontend now uses the app's required minimum, rather than the old reply's current window size. A newly reported smaller minimum can replace a stale larger limit.
- Retained the existing Apps header resize button and native corner cutout. No app-specific Codex dimensions were hard-coded.
- Built ver0.19 and copied the executable to the shared project root without replacing or launching any older binary. The test uses Still's normal identifier/profile; close the older Still window before testing it.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src/domain/appPanel.ts`, `layout.ts`, `workspaces.ts`
- `still-desktop/src/AppsWidget.tsx`, `WorkspaceCanvas.tsx`, `App.tsx`, `platform/appPanel.ts`
- `still-desktop/tests/app-panel.test.mjs`, `canvas.test.mjs`
- Package/Cargo/Tauri version metadata and `still-desktop/README.md`
- Local ignored artifact: `C:\Users\haoka\Projects\Default Project\ver0.19.exe`
- This report

## Checks
- Initial isolated test setup lacked dependencies in three test files; offline dependency installation resolved that setup issue. The inherited frontend baseline then passed all 56 tests and TypeScript.
- Observed two frontend regression failures for stale resize replies and obsolete larger limits before fixing them.
- Observed the native minimum fixture fail because the limit was unknown while the window was still larger. After implementation, it reads a 900 x 600 physical minimum at 150% scale as 600 x 400 CSS units and refuses smaller native bounds.
- Final frontend suite: 59 passed, 0 failed. TypeScript check passed.
- Final Rust suite: 29 passed, 0 failed; one opt-in real Chrome GUI test ignored.
- Tauri no-bundle Windows release build: passed, including TypeScript/Vite. Executable metadata verified as version 0.19.0 and copied bytes matched the build's SHA256.
- `git diff --check`: passed. Generated permission files had no semantic changes and were excluded from the focused commit.

## Handoff
- Test `ver0.19.exe`: attach a separate Codex window, shrink using the header or corner grip, verify it stops at the usable minimum and can expand again, then switch workspaces/reopen and verify persistence. Detach must leave the app and its document open.
- Real Codex interactive acceptance has not been performed. The native fixture proves the size-query/positioning contract, not Codex's live rendering or focus behavior.
- Maximum widget dimensions remain 3000 CSS pixels; an app demanding more remains clipped by the existing panel region. Unsupported/unresponsive minimum queries use the observed-size fallback.
- No changes to sidebar or screenshot-drag plans, no push, and no merge to `main`. Other agents should review this branch before integrating its replacement of the minimum-size work still pending in OpenCode's checkout.
- Windows references: [WM_GETMINMAXINFO](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-getminmaxinfo), [MINMAXINFO](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-minmaxinfo), [bounded message delivery](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendmessagetimeoutw).
