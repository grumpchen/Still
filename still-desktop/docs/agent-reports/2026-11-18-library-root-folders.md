# Task: Library root folders

- Agent: Codex
- Time: 2026-11-18T12:40:00+00:00

## Done
- Replaced per-workspace Library folder/Notes tree with an All workspaces root Files folder list.
- Kept Library Contents navigation unchanged and added English/Chinese labels.
- Added browser coverage for cross-workspace root folders, removed Notes/workspace entries, and folder selection.

## Files
- `src/LibraryHome.tsx`
- `src/localization.tsx`
- `src/styles.css`
- `tests/e2e/library-root-folders.spec.ts`

## Checks
- `pnpm check` passed.
- Focused Playwright test with system Chromium, one worker, trace off: 1 passed.
- `git diff --check` passed.

## Handoff
- No App.tsx wiring changes needed. Coordinator owns integration and release.
