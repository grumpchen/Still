# Task: Prevent stale Files previews

- Agent: Codex (GPT-6.1)
- Time: 2026-11-09T06:52:35+13:00, Pacific/Auckland

## Done
- Added per-selection request ownership to Files previews so delayed reads cannot replace the preview after another file is selected or the user navigates to another folder.
- Added the same newest-request guard to Markdown tab loading, and guarded save/reload UI updates against a changed selection. Saves still complete against the originally selected path and expected revision.
- Added deliberately out-of-order read regressions for the Files preview and integrated Notes tab.
- Confirmed the restored Files note editor still exposes open-note tabs/search, tags, formatting/font controls, note links, and Study with AI actions in existing regression coverage.

## Files
- `still-desktop/src/NotesLibraryExplorer.tsx`
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/tests/notes-library-explorer-folders.test.mjs`
- `still-desktop/tests/widget-relaunch.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed; existing large-chunk advisory remains.
- Focused Files, Notes AI, PDF calculation/highlight tests — 24 passed.
- Files and note-tab out-of-order read regressions — passed; the integration test takes about 3 minutes to initialize its full Vite app fixture.
- `git diff --check` — passed.
- Native Still process is still running from this checkout; no restart or file mutation was performed. Native interaction was not rerun in this increment.

## Handoff
- Other older Notes and Files behaviors have existing regression coverage, but full native file save/conflict and PDF interaction acceptance remains necessary. Continue the wider agent/workspace robustness goal.
