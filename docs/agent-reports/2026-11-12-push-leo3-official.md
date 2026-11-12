# Task: publish Still 0.235 snapshot as leo3-official

- Agent: Big Pickle (opencode)
- Time: 2026-11-12T14:57:22+13:00 (New Zealand Standard Time)

## Done
- Compared the `Still-0.235` snapshot against `main` of `grumpchen/Still` and overlaid the snapshot onto a fresh clone.
- Found the snapshot is effectively `main` plus one feature: a new canvas "add tool" context menu.
- Committed the snapshot on new branch `leo3-official` (main left untouched).
- Pushed the branch to `origin`.

## Files
- `CLAUDE.md` (new: agent behavioral guidelines)
- `still-desktop/src/AddToolContextMenu.tsx` (new)
- `still-desktop/tests/canvas-add-tool-menu.test.mjs` (new)
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/minimize.test.mjs`

## Checks
- `git diff --numstat` on the overlay: 5 modified files, 24 insertions / 5 deletions, plus 3 new files.
- Excluded `node_modules/`, `src-tauri/target/`, `dist/` and ignored `*.exe`/`*.zip` artifacts.
- Not run: app build, unit tests, Playwright suites.

## Handoff
- The snapshot source (`Downloads\Still-0.235`) is not a git repository; this branch is now the durable copy of that state.
- Verify the add-tool menu feature and run `still-desktop` tests before merging to `main`.
- Merge to `main` requires user approval.
