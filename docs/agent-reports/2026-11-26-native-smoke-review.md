# Task: Correct native rule smoke persistence lookup

- Agent: Codex (integration review)
- Time: 2026-11-26T14:52:00+00:00

## Done
- Corrected the smoke lookup to match the saved rule's actual source text. The fixture variable already excludes `Save a rule:`, so stripping that prefix a second time prevented a match.
- Requested Luna independently run the UI-only portion in Linux Chromium before the next Windows attempt.

## Files
- `still-desktop/scripts/windows-workbench-smoke.mjs`

## Checks
- `node --check`: passed.
- `git diff --check`: passed.
- Full native execution: pending next Actions candidate; prior basic native smoke passed before this extension.

## Handoff
- This changes the test harness only, not Still's rule parser or operation service. No native operation success is inferred from a static check.
