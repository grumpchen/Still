# Tray-rule smoke UI verification on Linux

## Scope

Verified the UI fixture setup used by the Windows smoke through a real Chromium browser against the Vite `design-preview.html` app. The isolated branch contains the one-line correction from the `sourceText` poll: it now compares the stored source to `ruleText` after the `Save a rule:` prefix is removed, instead of slicing that prefix from an already-unprefixed string.

## Results

Two fresh browser-context runs passed the full UI creation portion:

1. Opened Dashboard Layouts, saved a complete layout sourced from `Design`, and observed it in persisted `still-workspace-v2` with the expected `notes`, `ai`, and `files` widget types.
2. Opened Ask AI and sent `Save a rule: at <future ISO time> replace Study workspace with <layout name> layout`.
3. Observed Still AI's `Saved the automation rule.` response.
4. Found the saved rule by its exact unprefixed `sourceText`, layout ID, and target workspace ID. It was a `once` / `prepareWorkspaceLayout` / `replace` rule.
5. Confirmed before hide that there was no receipt, target widget IDs were unchanged, and the trigger time was still in the future. In the short due-time run, 9.1 seconds remained when the pre-hide assertion completed.
6. Captured no browser page errors.

The automation tick and native hidden-window stages were not run in Linux; they remain Windows-only validation.

## Checks

- `node --check still-desktop/scripts/windows-workbench-smoke.mjs` — passed.
- `git diff --check` — passed.
- Playwright Chromium UI flow — passed in two fresh contexts (one with a two-minute future date for locator flow; one with the smoke's ten-second due window).
