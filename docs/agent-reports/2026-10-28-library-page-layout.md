# Task: Give the Library its own page layout

- Agent: Codex
- Time: 2026-10-28T00:26:13+13:00 (Pacific/Auckland)

## Done
- Added a dedicated Library page with a Files/Notes navigation rail and a full-size content area, separate from movable widget cards.
- Kept the Dashboard as its fixed study home, with its compact Files preview and route into the full Library page.
- Prevented the built-in Library sections from being added, removed, minimized, or arranged as canvas widgets through regular and AI actions.
- Added English and Simplified Chinese text for the Library page.
- Preserved existing keyboard shortcuts and widget controls.

## Files
- `still-desktop/src/LibraryHome.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/DashboardHome.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported the existing large JavaScript chunk warning.
- `git diff --check` — passed.
- Manual Windows UI acceptance — not run in this turn.

## Handoff
- Library content uses existing native Files and Notes widgets inside a bespoke full-page shell. Native folder access and note persistence continue through their existing services.
- The Dashboard and Library reuse the Library Files widget data. Only the active page mounts its file browser to avoid simultaneous native folder-grant ownership.
