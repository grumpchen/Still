# Task: Verify minimized widget tags against the current UI

- Agent: Codex
- Time: 2026-10-28T01:40:00+13:00 (Pacific/Auckland)

## Done
- Updated the color-tag UI test to use the current add-on label and stable component selectors.
- Extended the test to minimize a tagged widget and verify that its color dot remains visible and its accessible name includes the tag color.

## Files
- `still-desktop/tests/widget-color-tag.test.mjs`

## Checks
- Focused widget color-tag test — passed, including minimized visibility and accessible label assertions.
- `pnpm check` — passed.
- `git diff --check` — passed.
- The last full frontend run before this selector update had 58 failing checks out of 298; this focused test was one of the failures and now passes. The full suite was not rerun after updating the selector.

## Handoff
- The compact tag requirement now has a focused rendering regression check. The remaining full-suite failures still need triage against current UI behavior.
