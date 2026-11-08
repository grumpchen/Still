# Task: create folders from Files

- Agent: Codex
- Time: 2026-11-09T03:36:04+13:00 (Pacific/Auckland)

## Done
- Added a New folder action to the unified Files explorer. The form creates a folder at the current breadcrumb location through Still's existing grant-checked native command, refreshes the listing, and navigates into the new folder after success.
- Errors remain visible in the form and do not trigger navigation. Browser preview does not offer native folder creation.
- Added a component-level regression test for nested-folder creation, exact command arguments, and invalid-name failure behavior.
- Added stable keys to rendered file rows, clearing the React list warning observed while running the new component test.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/platform/files.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- `pnpm check` passed.
- Focused Files preview, note persistence, and folder UI tests passed: 14/14.
- `git diff --check` passed.
- Native Still preview on the active branch showed the New folder control. No folder was created in the user's workspace during native verification.

## Handoff
- Folder creation uses the existing selected-folder grant and native validation. The UI confirmation was limited to the active Files control; native directory creation itself was verified through the component test/mock and existing native command, not by mutating a user folder.
- The larger Still agent robustness and workspace effort remains in progress.
