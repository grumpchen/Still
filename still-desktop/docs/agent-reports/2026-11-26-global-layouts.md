# Global workspace layouts

## Shipped in this branch

- Added named global workspace layouts with content, groups, Dashboard order and geometry, appearance settings, and created time.
- Added Dashboard actions to save, rename, duplicate, delete, and apply a layout to a selected workspace in append or replace mode. Every apply requires a fresh target and mode selection. Actions commit synchronously to local storage before returning a success receipt; failed persistence, stale IDs, duplicate names, invalid names, or the 24-layout cap return errors.
- Dashboard template capture records only visible modules and their measured positions and dimensions. Hidden Dashboard modules stay in their source workspace and do not become visible when the template is applied elsewhere. Applying a layout to a Dashboard preserves existing widget data while projecting the template's visible order and sizes.
- Template Notes documents detach external Markdown paths and library grants so a cloned note edits its own saved copy. Files folder references remain reusable; cloned Notes document IDs are remapped; running timers pause; open app panels are not cloned.
- Added a temporary Focus mode toggle with an always-visible exit control, and wired App's Widget Relaunch preference into the Canvas prop contract.

## Verification

- `pnpm check` passed.
- `node --import tsx --test tests/global-layouts.test.mjs` passed (5 tests), including hidden Dashboard module/geometry projection, detached Notes, Files grant reuse, timer pause, and parsing 30 existing valid layouts.
- Chromium Playwright passed `tests/e2e/dashboard-custom-layout.spec.ts` (2 tests), `tests/e2e/dashboard-layouts.spec.ts` (2 tests), including Dashboard save/reload/apply and Focus mode toggle/exit.
- No Windows build or native Windows fullscreen validation was run in this environment.
- The pre-existing `tests/workspace-controls.test.mjs` sidebar-edge assertion still fails on this branch; the regression worker is separately restoring those controls. Its Focus mode test passes.

## Notes

Global layout actions now return receipt strings or throw, so the same operation contract can be used by the workbench action dispatcher. The full shared AI dispatcher and Library operations are being integrated separately.
