# Task: Workspace widget Relaunch controls

- Agent: Codex (GPT-6)
- Time: 2026-10-11T17:01:42+13:00

## Done
- Added a Relaunch control to every workspace card, including minimized cards.
- Ordinary widget views remount in place while their saved widget data stays unchanged.
- Browser and Apps retain their mounted native controllers and re-present or recover through their existing panel APIs. Apps does not release a live attachment or launch another process during a successful re-present; a failed Apps relaunch marks the control red.
- Preserved the existing Group behavior and native overlap lifecycle.

## Files
- `src/WorkspaceCanvas.tsx`
- `src/AppsWidget.tsx`
- `src/BrowserWidget.tsx`
- `src/widgets.tsx`, `src/Icon.tsx`, and `src/canvas.css`
- `tests/widget-relaunch.test.mjs`

## Checks
- `node --test tests/widget-relaunch.test.mjs` — passed, 5 tests.
- `node --test --test-concurrency=1 tests/*.test.mjs` — passed, 162 tests.
- `pnpm --config.verifyDepsBeforeRun=false build` — passed TypeScript check and Vite production build.
- `git diff --check` — passed.
- Rust checks and Windows GUI acceptance — not run; no Rust code changed, and live native-window behavior remains for integration.

## Handoff
- The change is committed on `agent/luna/browser-overlap-visibility`; it is not pushed or merged. No new executable was built. Verify the control and native-window recovery in the Windows integration session.
