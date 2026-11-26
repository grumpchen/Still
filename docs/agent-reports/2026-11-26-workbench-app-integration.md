# Task: Workbench app integration

- Agent: Codex (coordinator); feature implementation by Luna workers
- Time: 2026-11-26T13:56:00+00:00

## Done
- Bound the shared collection dispatcher to the current App state and synchronous persistence.
- Mounted the automation runner at the App root, independently from whether Rules is visible, with the real capture event inbox.
- Connected the standard AI panel to global workspace/layout metadata and actual operation receipts; direct supported rule requests work without provider credentials.
- Added Capture, Rules and course Save layout controls; every capture selects a course. PDF references keep native opaque grants and stable capture attempt IDs.
- Routed the existing Quick note action through course-aware capture; existing note data remains untouched.
- Obscured native embedded surfaces while collection/rules dialogs are open and paused workspace shortcuts for those dialogs.
- Automatic layout preparation reuses the manual layout function with activation disabled.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/useStillWorkbench.tsx`
- `still-desktop/src/AutomationPanel.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm check`: passed.
- `pnpm build`: passed; existing large bundle advisory remains.
- `pnpm test`: 571 passed, 0 failed.
- End-to-end capture/rule flows: pending independent browser acceptance.

## Handoff
- Native close/move lifecycle and scoped layout Undo follow-ups are being integrated separately.
- Windows executable/CDP startup smoke currently times out waiting for its endpoint; the diagnostic revision is pending CI. Compilation success does not establish live tray acceptance.
