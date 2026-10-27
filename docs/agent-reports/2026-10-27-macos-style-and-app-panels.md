# Task: macOS styling and Apps panel behavior

- Agent: Codex
- Time: 2026-10-27T17:24:43+13:00 (Pacific/Auckland)

## Done
- Applied a system-font stack, rounded controls, subdued glass reflections that follow the pointer, and translucent widget interiors across both appearance themes. Kept the smooth, darker metal header.
- Failed initial app opens and attachments now remove the new widget or restore the previous Apps widget, then show an error notification. Replacing an attached app releases the old panel before attaching the selected window.
- Added a saved General setting for closing an attached app when its Apps widget is removed. It defaults to closing and sends a normal Windows close request after restoring the window; Detach still leaves the app open.
- Updated the README, architecture summary, and managed app panel plan to describe the close preference.

## Files
- `still-desktop/src/canvas.css`
- `still-desktop/src/AppsWidget.tsx`, `WorkspaceCanvas.tsx`, `widgets.tsx`, `App.tsx`
- `still-desktop/src/GeneralSettings.tsx`, `domain/workspaces.ts`, `platform/appPanel.ts`
- `still-desktop/src-tauri/src/app_panel.rs`
- `README.md`, `architecture.md`, `still-desktop/docs/plans/2026-10-05-managed-app-panels.md`

## Checks
- `git diff --check` — passed. Build and runtime checks were not run.

## Handoff
- Native app-close prompts and attach behavior still need live Windows acceptance with a disposable app/document.
