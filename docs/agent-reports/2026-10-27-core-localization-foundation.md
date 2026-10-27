# Task: core-localization-foundation

- Agent: Codex GPT-6
- Time: 2026-10-27T22:01:00+13:00

## Done
- Added persistent English/Simplified Chinese locale state with a version-10 workspace migration; existing user data and workspace roles remain intact.
- Added a language selector to General Settings and set the app root `lang` attribute.
- Localized the main sidebar, Dashboard, workspace names, built-in widget labels, Calendar, Files search/inbox controls, Notes study actions, and General Settings section headings.

## Files
- `still-desktop/src/localization.tsx`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/src/GeneralSettings.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/CalendarWidget.tsx`
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/tests/canvas.test.mjs`
- `still-desktop/tests/workspaces-relaunch-migration.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-chunk advisory (618.99 kB JS).
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- This is the first localization slice. Remaining Settings controls, the AI panel, dialogs, and less-used widgets still need translation. Continue with Settings cleanup and minimized tag visibility, then finish translations across the remaining surfaces.
