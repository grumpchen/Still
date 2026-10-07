# Task: Transparent workspace and compact controls

- Agent: Codex
- Time: 2026-10-08T02:04:30+13:00 (Pacific/Auckland)

## Done
- Enabled a transparent Tauri main window and made the native desktop view transparent behind the existing glass controls. The built-in wallpaper and canvas texture are hidden only in the desktop runtime; no click-through behavior was added.
- Simplified Attach Open App rows to show app icon, app/window names and status; selection uses the single dialog-level Attach action. Search, Refresh and Open app remain. The app list is contained in a vertical scroll area.
- Removed collapsed workspace abbreviations while preserving full workspace names as title and accessibility labels.
- Open widgets now save to a new or existing Group only. Blank tray space still removes; external files, apps and website drops keep their existing normal-button behavior.
- Kept native white-stripe work separate by basing this branch on app-tray baseline b075eee, without the r7 native repaint commit.

## Files
- still-desktop/src-tauri/tauri.conf.json
- still-desktop/src/main.tsx
- still-desktop/src/styles.css
- still-desktop/src/canvas.css
- still-desktop/src/App.tsx
- still-desktop/src/AppWindowPicker.tsx
- still-desktop/src/WorkspaceCanvas.tsx
- still-desktop/src/domain/trayDrop.ts
- still-desktop/tests/trayDrop.test.mjs
- Test executable: still-desktop/src-tauri/target/release/ver0.21-test-ui-cleanup.exe (SHA-256 AFC6147D74C97374AC113287DDF80570F580D6FE6CDB5B0CDC86A6F6F939A92D)

## Checks
- node --test tests/trayDrop.test.mjs — passed, 10 tests.
- corepack pnpm build — passed (TypeScript and Vite).
- corepack pnpm tauri build --no-bundle — passed.
- Full corepack pnpm test — 7 failures remain in existing baseline expectations: selected app icon PNG bounds/identity; canvas height bound; Chrome scroll-start/settle timing; inline tray disclosure layout; Apps shortcut icon-only/+ dialog behavior; shared disclosure button behavior; and app shortcut icon validation/accessibility. These are outside the changed behavior; focused tray-drop tests pass.
- The executable was not launched. Transparent desktop rendering and the dialog appearance still require the user's live Windows check.

## Handoff
- Baseline: b075eee59b1e7a0d4df8efcbfa8f35c27fef3c43; branch: agent/codex/ui-cleanup.
- Candidate is test-only, not a release. Keep white-stripe debugging on its own branch.
