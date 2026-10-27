# Task: Refresh settings regression checks for localized UI

- Agent: Codex
- Time: 2026-10-28T01:49:45+13:00 (Pacific/Auckland)

## Done
- Updated General and Appearance settings assertions to use current localized labels and tab markup.
- Replaced obsolete leaf-photo background assertions with checks for LiquidChrome, LineWaves, and the wave wallpaper options.
- Updated app shutdown choices and widget action checks to match the current localized controls.
- Kept coverage for plugin scopes, click-through gating, keyboard shortcuts, locale-aware tab structure, and compact checkbox styling.

## Files
- `still-desktop/tests/app-settings.test.mjs`
- `still-desktop/tests/settings-dialog.test.mjs`

## Checks
- Focused AI, Notes, Settings, and minimized-tag suite — 54 passed, 0 failed.
- `git diff --check` — passed.
- Production code unchanged in this task.

## Handoff
- The previous full suite had 58 failures before refreshing the outdated color-tag and settings assertions. It has not been rerun since; remaining failures still need triage.
