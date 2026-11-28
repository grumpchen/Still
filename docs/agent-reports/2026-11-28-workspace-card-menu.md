# Task: Workspace card capture menu

- Agent: /root/luna_native
- Time: 2026-11-28T06:09:53+00:00

## Done
- Moved the workspace card Copy screenshot and Export PNG actions from the crowded card header into the existing right-click widget context menu.
- Kept screenshot plugin scope and tag color overrides as the gate for Copy screenshot; retained the existing Export PNG preference and Apps exclusion.
- Adjusted menu vertical positioning for the extra actions and updated UI regression tests to verify the context menu entries and settings.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/WidgetContextMenu.tsx`
- `still-desktop/tests/widget-relaunch.test.mjs`
- `still-desktop/tests/unified-widget-header.test.mjs`

## Checks
- `pnpm check` passed.
- `pnpm exec tsx --test --test-name-pattern='Screenshot widget plugin|widget menus omit relaunch|Apps omits its PNG' tests/widget-relaunch.test.mjs tests/unified-widget-header.test.mjs` passed (3 tests).
- `git diff --check` passed.
- A broader run of `widget-relaunch.test.mjs` shows four unrelated Notes/DOM failures. Re-running those same test cases on unchanged baseline `b729b80` produced the same four failures.

## Handoff
- Right-click a non-minimized card to access its capture actions. Screenshot availability continues to honor global/tag-color/off and per-color override settings. PNG export continues to honor its existing visibility setting. No manual desktop GUI test was run.
