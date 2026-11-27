# Open installed apps from Still AI

- Agent · Codex
- Time · 2026-11-27T19:43:44+08:00

## Done

- Still AI opens a named app from the Windows Apps catalog. Common aliases include Chrome, Edge, Word, and VS Code. The action works from Dashboard and workspaces without a model connection.
- Partial and ambiguous matches ask for a full name or a shortcut selection. The app uses the existing Windows shortcut launcher and leaves the workspace layout alone.

## Files

- `still-desktop/src/AssistantPanel.tsx` and the installed-app request parser and adapter
- `still-desktop/src-tauri/src/app_picker.rs` and the native app shortcut launcher
- Browser regression and Windows workbench smoke checks

## Checks

- TypeScript, 606 frontend tests, and 18 targeted Playwright checks passed. Browser tests simulate the Windows IPC responses.
- The Windows smoke check verifies that Chrome acquires a native window and that the Dashboard workspace stays the same.

## Handoff

- The launch uses a regular Windows desktop window. Still reports when Windows accepts the request or returns an error.
- Publication is on hold at the user's request.
