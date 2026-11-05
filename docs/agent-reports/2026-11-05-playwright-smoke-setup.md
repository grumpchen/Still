# Task: playwright-smoke-setup

- Agent: Codex
- Time: 2026-11-05T17:51:49+13:00 (Pacific/Auckland)

## Done
- Added Playwright Test as an exact development dependency and pinned the project package manager to the locally available pnpm 11.24.0.
- Added a headless Microsoft Edge smoke test that starts Vite on port 4174 and checks the Study dashboard heading and widget grid.
- Allowed the existing esbuild postinstall in pnpm workspace policy; excluded the existing pinned Vite version from the minimum release age policy.
- Added Playwright output to .gitignore.

## Files
- still-desktop/package.json
- still-desktop/pnpm-lock.yaml
- still-desktop/pnpm-workspace.yaml
- still-desktop/playwright.config.ts
- still-desktop/tests/e2e/workspace-smoke.spec.ts
- still-desktop/.gitignore

## Checks
- `pnpm test:e2e` — passed: 1 test, headless Microsoft Edge.
- The test verifies the browser preview dashboard only; Tauri native app window behavior and attached application panels require desktop testing.

## Handoff
- Run `pnpm test:e2e` from `still-desktop/`. Microsoft Edge must be installed. Playwright uses the installed Edge channel and does not download a browser.
