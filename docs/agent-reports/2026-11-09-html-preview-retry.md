# Task: Keep HTML preview retry available

- Agent: Codex
- Time: 2026-11-09T16:44:00+13:00

## Done
- Kept the on-demand preview placeholder visible while loading and after a failed HTML read, so the user can retry.
- Confirmed the running Still process uses this branch's debug executable, but that executable predates the HTML backend change. The native `files_preview` command therefore rejects HTML; no system default app is required for the in-Still preview.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- `pnpm check` — passed.
- Files Explorer focused tests — 5 passed, including a failed first read followed by a successful retry.
- `cargo build --bin still-desktop` — blocked because the running Still process locks `target/debug/still-desktop.exe` (Windows access denied).

## Handoff
- The native HTML preview requires rebuilding the debug executable after the running Still window is closed. It was not forcibly closed or relaunched.
