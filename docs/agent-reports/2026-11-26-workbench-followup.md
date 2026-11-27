# Task: workbench dispatch follow-up

- Agent: luna_regressions
- Time: 2026-11-26T13:55:11Z

## Done
- Added typed collection dispatch for file reference rename, move, and delete.
- Capture automation now accepts `ignored` events as a distinct terminal state, only executes `pending` events, and explicitly clarifies quarantined legacy link origins.
- Updated Browser source lookup to use actual `browser` widgets, while including only legacy unlinked Group widgets and avoiding duplicate mapped Groups.
- Treats nonempty `folderName` as a connected chosen folder when `folderKey` is null, includes it in folder search, and skips native search when no folder grant exists.
- Replaced the obsolete AssistantLibraryTools native UI test with a test of its current Workbench dispatcher replacement, using real shared collection operations for PDF reference and Browser link movement.

## Files
- `still-desktop/src/platform/workbenchOperations.ts`
- `still-desktop/tests/workbench-operations.test.mjs`
- `still-desktop/tests/assistant-library-tools.test.mjs`

## Checks
- `pnpm check` passed.
- `pnpm test`: 563 passed, 0 failed.
- Workbench focused tests: 13 passed.
- `git diff --check` passed.

## Handoff
- Based on root integration commit `1917a9f` (the requested `2e11646` parent plus dispatcher cherry-pick). The automation adapter requires the current course catalog injection already handled by root wiring.
