# Task: guard the former Notes features in Files

- Agent: Codex (GPT-6)
- Time: 2026-11-09T05:06:40+13:00, Pacific/Auckland

## Done
- Updated the Notes/Files integration test to match the current folder-first Files workspace and PDF.js viewer.
- Added regression checks for the earlier Notes editor features in that view: local and file-backed tabs, open-note search, tags, formatting/font controls, note links, and Explain, Summarize, Flashcards, Study outline, and Quiz.
- This replaces stale assumptions about the removed Notes-mode toggle and old PDF frame; no product code changed.

## Files
- `still-desktop/tests/widget-relaunch.test.mjs`

## Checks
- `node --import tsx --test --test-name-pattern="Notes library opens Markdown tabs|AI summary notes" tests/widget-relaunch.test.mjs` — 2 passed.
- Files, note persistence, preview lifecycle, folder creation, PDF highlights, and calculations — 20 passed.
- `git diff --check` — passed.
- These checks use JSDOM and mocked native operations; no native window was restarted or exercised in this step.

## Handoff
- Existing native visual verification of the restored Notes editor is recorded in `docs/agent-reports/2026-11-09-restore-note-tools-in-files.md`. Native file save/conflict acceptance remains outstanding.
