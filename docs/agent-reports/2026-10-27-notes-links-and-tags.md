# Task: Notes search, tags, and links

- Agent: Codex
- Time: 2026-10-27T23:55:41+13:00

## Done
- Added bounded, validated tags to local and library-backed note documents.
- Added search across open note titles, content, and tags.
- Added durable `[[note:<id>]]` links, a picker for inserting links, and clickable linked-note and referenced-by lists.
- Added English and Simplified Chinese labels; existing local autosave, library stale-write checks, and AI study actions remain connected.

## Files
- `still-desktop/src/domain/noteDocuments.ts`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-bundle advisory.
- `git diff --check` — passed.
- Native Notes file I/O was not exercised in this stage.

## Handoff
- Tags and note links are Still workspace metadata stored with each note document. The underlying Markdown file text remains user-authored; the UI does not rewrite files to add metadata.
