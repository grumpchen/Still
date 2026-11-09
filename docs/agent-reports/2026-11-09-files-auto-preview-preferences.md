# Task: Add configurable automatic file previews

- Agent: Codex
- Time: 2026-11-09T16:39:00+13:00

## Done
- PDF, Markdown/text, images, audio, and video preview automatically by default. HTML stays manual by default.
- Added a Files preview settings menu to choose automatic preview types. Preferences persist locally and apply across Files widgets.
- Disabled automatic previews show a Preview now action. HTML renders in Still's isolated browser frame with scripts enabled but without same-origin access to Still or local files. The external default-app actions remain available.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/src/localization.tsx`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Files Explorer focused tests — 5 passed, covering HTML on-demand behavior and configurable preferences.
- Rust HTML allowlist test — passed earlier in this task sequence using the binary target.
- Native Still UI was not restarted or visually checked.

## Handoff
- A Windows default application cannot be hosted inside Still's preview pane. HTML uses Still's WebView browser engine in an isolated frame; Open default app still launches the registered external handler.
- The HTML read support is in the native backend. An older running executable must be rebuilt/restarted before it can load HTML; no new window was launched.
