# Task: Apps native occlusion

- Agent: Codex
- Time: 2026-10-10 (Pacific/Auckland)

## Done
- Compared the historical Browser implementation in v0.18 with the Sidebar Test source recorded at `56fd43c` (the preceding Browser code commit is `5321615`). The Sidebar Test build report records the actual source HEAD; the executable itself has no embedded Git revision for independent binary attestation.
- Confirmed that historical Browser geometry selected higher-ranked cards and hid the lower native Browser window on overlap. The Still card remained rendered, and visibility changes reused the same top-level HWND.
- Found the Apps divergence: `AppsWidget` already supplied only higher-ranked cards, but `appPanelGeometry` sent their intersections as native region cutouts while leaving `visible` true. The lower app could therefore remain visible around those cutouts.
- Updated Apps geometry to hide its native HWND when a higher card has a positive-area intersection with the clipped app-content area. Header-only overlap and edge touching remain visible; moving clear restores through the existing presentation call. The attach, resize, workspace visibility, and release paths were not changed.

## Files
- `still-desktop/src/domain/appPanel.ts`
- `still-desktop/tests/app-panel.test.mjs`
- `still-desktop/tests/apps-widget-present.test.mjs`

## Checks
- Regression test first failed on old behavior (`visible: true` for covered lower content), then passed after the change.
- `node --test tests/app-panel.test.mjs tests/apps-widget-present.test.mjs tests/browser-widget-present.test.mjs` — 14 passed.
- `npm run check` — passed.
- `npm run build` — passed.
- Full `npm test` — 139 passed, 2 unrelated failures: selected app icon data URL expectation and canvas-height bound expectation.
- `cargo test chrome_overlay::tests` — 4 passed, 1 ignored (real Chrome smoke test).
- `cargo test app_panel::tests` — 18 passed, 2 minimum-size fixture failures (`c1_a_maximized_first_sample_never_becomes_the_floor`, `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted`). No native Rust files changed.
- Windows Still + external-app GUI acceptance was not run; the copied Sidebar Test executable was not launched.

## Handoff
- Review and integrate from the isolated `agent/luna/browser-overlap-visibility` branch. Do not treat the rendered command-boundary test as Windows GUI acceptance.
