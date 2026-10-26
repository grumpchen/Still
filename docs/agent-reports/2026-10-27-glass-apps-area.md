# Task: Glass apps area

- Agent: Codex
- Time: 2026-10-27T10:32:32+13:00

## Done
- Replaced the always-visible widget tray row with a thin, text-free glass strip at the bottom of the canvas that expands on hover or keyboard focus.
- Added Apps and Shortcuts pages. Apps uses Still's existing bounded Windows Start Menu/Desktop shortcut catalog; selecting an app creates a managed Apps widget. Shortcuts preserves saved presets and Groups.
- Added an explicit Trash control and made the installed-app grid a widget drop-to-remove target, with red feedback. External file drops do not trigger widget removal.
- Prototyped the reflective glass surface on Notes only; other widget cards are unchanged.

## Files
- `still-desktop/src/WorkspaceDock.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/TrayEditor.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm --dir still-desktop check` passed.
- `pnpm --dir still-desktop build` passed; Vite emitted its existing large-chunk warning.
- `git diff --check` passed.
- Automated tests and live Windows UI checks were not run.

## Handoff
- The Apps catalog mirrors the existing app picker and therefore lists Start Menu/Desktop shortcuts, not every installed package with no shortcut.
- The glass material is a lightweight CSS prototype rather than the React Bits WebGL/camera component; it avoids camera permission and per-frame shader work.
- Notes is the only widget using the new material until the appearance is reviewed.
