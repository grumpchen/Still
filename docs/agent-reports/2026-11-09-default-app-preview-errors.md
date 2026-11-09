# Task: Default app fallback errors

- Agent: Codex GPT-6
- Time: 2026-11-09T16:04:16+13:00 (Pacific/Auckland)

## Done
- Confirmed unsupported files already use the Windows default app only after the user clicks **Open default app**; file selection itself does not start another app or load a native viewer.
- Made default-app launch errors visible in the unsupported-file preview area in both Files and Library. Kept program and shortcut blocking in the native file command.

## Files
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm exec tsx --test --test-concurrency=1 tests/notes-library-explorer-folders.test.mjs` — passed, 4/4; includes the no-default-app error.
- `pnpm build` — passed; Vite reported its existing large-chunk advisory.
- `git diff --check` — passed.
- Native Still UI was not restarted or visually tested.

## Handoff
- The default app opens in its own Windows window. Rendering arbitrary native applications inside the preview pane is a separate native-window-hosting feature and is not done by this fallback.
