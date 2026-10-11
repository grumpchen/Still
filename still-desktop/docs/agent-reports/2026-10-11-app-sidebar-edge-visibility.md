# Task: Apps sidebar edge visibility

- Agent: Codex GPT-6
- Time: 2026-10-11T15:12:00+13:00 (Pacific/Auckland)

## Done
- Reproduced the issue in a rendered AppsWidget-to-native-presentation test: moving the app 20 CSS pixels beyond the workspace's left edge still sent `visible: true`.
- Apps geometry now treats horizontal crossing of the workspace viewport as an occlusion. The native app surface hides at the sidebar/left edge and right edge, then shows again when moved clear; its widget card remains rendered.
- The test verifies hide/recovery without another open/attach or release command.

## Files
- `src/AppsWidget.tsx` passes the actual workspace viewport's left boundary separately from the clipped content rectangle.
- `src/domain/appPanel.ts` applies the horizontal edge visibility condition.
- `tests/apps-widget-present.test.mjs` covers rendered hide/recovery for both horizontal edges.
- `tests/app-panel.test.mjs` covers edge-touching visibility decisions.

## Checks
- Red reproduction: `node --test tests/apps-widget-present.test.mjs` failed as expected with actual `visible: true` when the card crossed the sidebar edge.
- `node --test tests/apps-widget-present.test.mjs tests/app-panel.test.mjs` — 15 passed.
- `node node_modules\\typescript\\bin\\tsc --noEmit` — passed.
- `node node_modules\\vite\\bin\\vite.js build` — passed.
- `node --test --test-concurrency=1 tests/*.test.mjs` — 155 passed, 0 failed.
- `git diff --check` — passed.
- No Rust code changed. Real attached-app Windows rendering and horizontal-scroll acceptance were not run.

## Handoff
- The browser/Apps native region code is unchanged. The presentation path hides the same attached app using its existing visibility command; it does not reattach or relaunch it.
- Windows integration should verify the white-stripe symptom during horizontal scroll with a real attached app.
