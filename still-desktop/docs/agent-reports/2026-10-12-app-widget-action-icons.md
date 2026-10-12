# Task: App widget action icons

- Agent: Codex
- Time: 2026-10-12T16:03:37+13:00 (Pacific/Auckland)

## Done
- Added right-aligned action icons to Attach, Detach, and Save to tray settings, matching Relaunch and Export PNG.
- All five widget action settings now share compact 15px circular checkboxes. Enabled state fills the circle without a checkmark.

## Files
- `src/GeneralSettings.tsx`, `src/Icon.tsx`, `src/styles.css`
- `tests/app-settings.test.mjs`

## Checks
- Focused app settings and rendered widget tests: 20 passed.
- `pnpm.cmd --config.verifyDepsBeforeRun=false check`: passed.
- `pnpm.cmd --config.verifyDepsBeforeRun=false build`: passed.
- `git diff --check`: passed.
- No Rust or live Windows GUI behavior changed or tested.

## Handoff
- Apps and general workspace action rows use the same icon-right, small-circle visual treatment. The labels and settings behavior are unchanged.
