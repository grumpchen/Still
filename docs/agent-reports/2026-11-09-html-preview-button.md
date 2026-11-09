# Task: Add on-demand isolated HTML preview

- Agent: Codex
- Time: 2026-11-09T16:26:00+13:00

## Done
- Added a Preview in Still action for `.html` and `.htm` files; HTML content is not read until the action is clicked.
- Added native preview MIME support for HTML while retaining the existing size limit and file-root validation.
- Rendered the source in a sandboxed iframe with a restrictive CSP that blocks scripts and external requests. The system default-app actions remain available.
- Added English and Simplified Chinese labels and a focused frontend regression test.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/localization.tsx`
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- `pnpm check` — passed.
- Files Explorer focused tests — 5 passed, including lazy HTML loading and iframe sandbox attributes.
- Rust focused test — not run because `cargo` is unavailable in this shell.

## Handoff
- The native preview whitelist change requires a rebuilt/restarted Still development app before the new action can read HTML. The active native window was not restarted or replaced.
