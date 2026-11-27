# Task: Library web preview fallback

- Agent: Luna (model not recorded)
- Time: 2026-11-26T14:37:29+00:00

## Done
- Guarded Downloads Inbox platform access when Tauri is unavailable. Browser Library shows an explicit desktop-only status and guidance to manage saved PDF shortcuts and links; it does not render an empty inbox or invoke a missing Tauri API.
- In browser preview, Library opens the first collected PDF shortcut when available, otherwise Saved links. Native default entry remains Downloads Inbox.
- Updated Library description to say that it covers saved links and course file shortcuts while Notes stay in their course. Removed Notes from the generic Files welcome text.

## Files
- `src/FilesWidget.tsx`, `src/LibraryHome.tsx`, `src/localization.tsx`, `src/platform/files.ts`
- `tests/library-browser-preview.test.mjs`

## Checks
- `pnpm check`: passed.
- `node_modules/.bin/tsx --test tests/library-browser-preview.test.mjs tests/library-search-without-folders.test.mjs`: passed, 2/2.
- `git diff --check`: passed.

## Handoff
- Native Downloads Inbox still calls the existing Tauri command and is selected by default in the desktop app.
- Browser preview can manage metadata for saved PDF shortcuts and links; opening a local document still requires its preview source to be reconnected in this browser session.
