# Task: protect Files marquee selection

- Agent: Codex (GPT-6)
- Time: 2026-11-09T05:10:07+13:00, Pacific/Auckland

## Done
- Added a pointer-drag regression test for selecting multiple rows in the Files sidebar.
- Confirmed the selection is represented by highlighted rows and does not add per-file checkbox controls, matching the requested marquee interaction.

## Files
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`

## Checks
- `node --import tsx --test tests/notes-library-explorer-folders.test.mjs` — 2 passed.
- `pnpm.cmd check` — passed.
- `git diff --check` — passed.
- Pointer behavior was tested in JSDOM; native drag acceptance was not performed.

## Handoff
- Selection remains visual only; bulk file actions are not implemented. Native preview stays running and was not restarted.
