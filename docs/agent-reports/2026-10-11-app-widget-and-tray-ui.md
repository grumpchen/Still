# Task: Apps visibility and tray UI fixes

- Agent: Codex (GPT-6)
- Time: 2026-10-11T00:03:02+13:00 (Pacific/Auckland)

## Done
- Verified the Apps/native overlap fix already on this branch: rendered Apps widgets send higher-card occlusion through the presentation path, hide only the lower HWND, and restore the same attachment when clear. The focused Apps and Browser presentation tests passed.
- Kept the Group card X behavior: it prompts before removing the floating card and preserves its saved Group in the tray. Added a focused regression check.
- When a new saved shortcut is added, scroll the tray row to the end so the shortcut and the shifted Saved + control are in view together.
- Give Quiet Minimal an opaque app surface in the transparent Tauri window; Liquid Glass stays transparent.
- Built a fresh Windows executable at `still-desktop/src-tauri/target/release/still-desktop.exe`. It was not launched; Windows GUI acceptance remains with integration.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/tests/inlineTray.test.mjs`

## Checks
- `node --test tests/inlineTray.test.mjs tests/group-tray.test.mjs` — 32 passed.
- `node --test tests/app-panel.test.mjs tests/apps-widget-present.test.mjs tests/browser-widget-present.test.mjs` — 14 passed.
- `npm run check` — passed.
- `npm run build` — passed.
- `npm test` — 142 passed, 2 failed: the existing app-icon byte-bound expectation and canvas-height bound expectation.
- `cargo check` — passed.
- `cargo test app_panel::tests` — 18 passed, 2 failed: the existing c1/c2 minimum-size floor fixtures.
- `npm run tauri -- build --no-bundle` initially could not find Cargo on PATH. With the installed Cargo directory added to PATH, it built `src-tauri/target/release/still-desktop.exe`; the frontend build succeeded despite pnpm warning that the workspace hoist directory was not a real directory.

## Handoff
- Do not treat the executable build or rendered-widget tests as Windows GUI acceptance. Integration should test real Apps occlusion/recovery, Group close confirmation, tray auto-scroll, and Quiet Minimal opacity in the packaged app.
