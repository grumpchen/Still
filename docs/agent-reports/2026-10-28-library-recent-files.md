# Task: Add a recent-files view to Library

- Agent: Codex
- Time: 2026-10-28T00:39:26+13:00 (Pacific/Auckland)

## Done
- Added a Recent section to the dedicated Library page with localized file names, relative paths, and open times.
- Recent entries appear only after a file preview succeeds and are capped at 12 items.
- Clicking a recent entry returns to the same granted folder and reopens the file inside Still.
- Persisted only widget identity, file name, relative path, and timestamp; validated stored paths and timestamps before use.
- Kept file access within existing native folder grants. No folder scanning or new grants were added.

## Files
- `still-desktop/src/domain/libraryRecents.ts`
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/LibraryHome.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported a JavaScript chunk above 500 kB.
- `git diff --check` — passed.
- Native folder-grant and Windows UI acceptance — not run in this turn.

## Handoff
- Recent history is local to this Still installation. If the selected folder grant is changed or revoked, an old recent item reports that it is unavailable.
