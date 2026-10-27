# Task: Library multiple course folders

- Agent: Codex GPT-6
- Time: 2026-10-28T00:46:07+13:00 (Pacific/Auckland)

## Done
- Added a dedicated Folders section to the Library page with independent folder navigation, an Add course folder action, and removal controls when more than one folder exists.
- Added a 40-folder cap and localized limit feedback in English and Simplified Chinese.
- Recent-file entries now include all Library folders and reopen from the folder that owns the file.
- Kept the Library page in its bespoke app-page layout; Dashboard remains a separate fixed home composition, while ordinary widgets keep their canvas layout and keyboard controls.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/LibraryHome.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reports the existing large JavaScript chunk warning (>500 kB).
- `git diff --check` — passed.
- Windows desktop UI acceptance was not run.

## Handoff
- Each course folder uses the existing native folder selection and access-grant flow. No unrestricted file access was added.
