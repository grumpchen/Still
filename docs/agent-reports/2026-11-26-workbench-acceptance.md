# Task: Workbench browser acceptance

- Agent: Codex (coordinator)
- Time: 2026-11-26T14:06:00+00:00

## Done
- Added independent user-flow tests for explicit course capture of ideas/links/a real PDF fixture, Library editing of original saved links, complete course templates with append/replace/undo, and one-sentence rule creation through Still AI.
- Verified actual rule filing into another course and persistent receipts; a subsequent run and reload do not duplicate the saved link.
- Fixed dialog accessible names and a real focus-button hit target that covered Show sidebar in normal mode.
- Enabled dependency cache saving on failed Windows jobs so a native smoke limitation does not force full dependency rebuilds.

## Files
- `still-desktop/tests/e2e/workbench-acceptance.spec.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/src/canvas.css`
- `.github/workflows/windows-build.yml`

## Checks
- Complete course capture/Library/template browser flow: passed (17.2 seconds, Linux Chromium).
- Still AI sentence → saved rule → actual captured link filed → receipt → run/reload deduplication: passed in the preceding browser run after the dialog naming fix.
- Library original-link management browser flow: passed.
- Earlier integrated check/build/unit run: 571/571 passed; final rerun pending remaining follow-up integration.

## Handoff
- The first acceptance attempt found an actual CSS hit-target overlap and a missing dialog name; both were fixed, rather than forcing clicks.
- The Windows executable smoke is being rerun with process diagnostics after the first CDP endpoint startup timeout. No live tray success is claimed.
