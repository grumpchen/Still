# Task: Integrate workbench preview feedback

- Agent: Codex (gpt-6.2-sol), with Luna feature workers
- Time: 2026-11-27 Asia/Shanghai

## Done
- AI Command Done minimizes the card. Pointer single click runs after the double-click window, double-click opens editing, and keyboard activation runs directly.
- Removed relaunch arrows on both expanded and minimized widget cards. The startup defer recovery button still works.
- Scoped the Add widget context menu to the canvas background. Widget actions, edit fields, text selections and Files-specific actions keep their own menus.
- Connected Still AI to the currently visible Files widget and relative folder or file metadata. Common create and rename requests resolve locally. A rename waiting for a name checks that the same file is still targeted before acting.
- The Windows smoke exercises creation and rename of an actual file in a temporary subfolder of the isolated runner's Still Downloads inbox, using the two phrases reported by the tester.
- Updated the in-app version to v0.2372 for the new test release.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`, `src/widgets.tsx`, `src/WidgetContextMenu.tsx`
- `still-desktop/src/platform/currentFilesView.ts`, `src/useStillWorkbench.tsx`, `src/AssistantPanel.tsx`
- `still-desktop/scripts/windows-workbench-smoke.mjs`

## Checks
- Chromium AI Command feedback test passed.
- Current Files context and reported command parser tests passed.
- Windows end-to-end creation/rename and integrated checks are recorded with the release evidence.

## Handoff
- The published preview should be taken from the same verified Windows Actions run. No main merge is part of publishing a testing prerelease.
