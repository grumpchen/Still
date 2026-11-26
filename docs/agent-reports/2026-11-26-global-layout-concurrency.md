# Global layout concurrency fix

## Changes

- Global layout application now waits for required native App releases, then plans the change against the latest captured state.
- The planner normalizes expected native App close-state changes, rejects a changed or missing target/template, and preserves unrelated workspace edits and the latest active workspace selection.
- Undo now records the target workspace as it existed immediately before the layout commit, including the fact that already-released App windows are closed. An Undo restores widget data and does not claim to reopen native windows.
- Applying a layout to the aggregate Library view is rejected. The Dashboard target picker omits Library, while real Dashboard, Study, and custom workspaces remain available.
- Added snapshot-level concurrency tests for rebasing, stale target/template conflicts, prepare mode, and Library rejection.

## Verification

From `still-desktop`:

- `pnpm check` — passed.
- `node --import tsx --test tests/global-layout-apply-race.test.mjs tests/global-layout-undo.test.mjs` — 7 passed.
- `git diff --check` — passed.

No Windows verification was run for this change.
