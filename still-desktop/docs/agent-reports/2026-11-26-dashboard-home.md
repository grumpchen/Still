# Task: Dashboard home and editable modules

- Agent: Luna
- Time: 2026-11-26T13:01:00+00:00 (UTC)

## Done
- App startup now selects Dashboard while retaining the last non-built-in workspace for a Resume button. Dashboard startup hides the sidebar and requests native fullscreen; Escape continues to use the existing exit handler.
- Added a Today schedule strip from the Dashboard Calendar events.
- Replaced the fixed Dashboard editor with a draft editor for adding supported widgets, removing them from the visible layout without deleting widget data, moving modules, and resizing them. Done persists; Cancel rolls back draft content, modules, order, and geometry. Migrated prior type-keyed dimensions to widget IDs.
- Registered Browser as a workspace widget with a validated, persisted HTTPS address; legacy Browser data from older state versions still migrates into Groups.
- New and unspecified glass configurations now use the static wave wallpaper. Explicitly saved background effect choices remain intact.
- Added Linux Chromium Playwright configuration through `STILL_PLAYWRIGHT_EXECUTABLE_PATH` and `STILL_PLAYWRIGHT_PORT`.

## Files
- `src/App.tsx`, `src/DashboardHome.tsx`, `src/domain/appearance.ts`, `src/domain/widgetCatalog.ts`, `src/domain/workspaces.ts`, `src/styles.css`, `src/widgets.tsx`
- `playwright.config.ts`, `tests/appearance.test.mjs`, `tests/browser.test.mjs`, `tests/dashboard-home-layout.test.mjs`, `tests/e2e/dashboard-custom-layout.spec.ts`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Focused domain/UI tests — 14 passed.
- Playwright Dashboard edit/cancel and Browser add/Done/reload/resume — 2 passed using Linux system Chromium at 1440×1000.
- Full frontend suite — 502 tests: 467 passed, 35 failed. Existing failures remain; main baseline run was 464 passed, 38 failed. See `/tmp/still-luna-dashboard-tests.log` for this run.
- Production performance harness (6 reloads, Study then Dashboard switches, Linux system Chromium, 1440×1000): median startup 86.9 ms, Study switch 153.8 ms, Dashboard switch 73.8 ms. Coordinator's dynamic-background baseline was 1,250 ms, 2,941 ms, and 2,915 ms respectively. This local software-GPU result is not a Windows measurement.
- Native Windows fullscreen, embedded Browser webview, and Windows release build were not tested.

## Handoff
- The embedded native Browser implementation is being handled in a separate task; this branch supplies the Browser widget model, Dashboard layout slot, and persistence. The current Browser shortcut surface opens links through Still's Chrome path.
- Native child webviews may cover overlapping canvas cards; steady overlap occlusion remains to be checked in the Browser/WorkspaceCanvas integration.
- Do not claim native fullscreen or Windows acceptance until tested on Windows.
