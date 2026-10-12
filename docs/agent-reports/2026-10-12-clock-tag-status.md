# Task: Register Clock in Tag Color Status

- Agent: Codex
- Time: 2026-10-12T17:25:37+13:00 (Pacific/Auckland)

## Done
- Registered Clock Timer in the Tag Color Status plugin catalog and color-setting dropdown.
- Added persisted global, selected-color, and per-color override settings; color overrides take precedence and control visibility of the per-card Clock button.
- Recorded the standing rule to register future workspace plugins in Tag Color Status.

## Files
- `still-desktop/src/domain/clockPlugin.ts`
- `still-desktop/src/domain/widgetPlugins.ts`
- `still-desktop/src/WidgetPluginStatusControls.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/tests/widget-relaunch.test.mjs`
- `still-desktop/tests/timer-status.test.mjs`

## Checks
- `node --test --test-name-pattern="Tag Color Status exposes Clock|Clock add-on visibility|Clock plugin scope" tests/widget-relaunch.test.mjs tests/timer-status.test.mjs` — passed, 4 tests.
- `pnpm test` — passed, 206 tests.
- `pnpm check` — passed.
- `pnpm build` — passed.
- `git diff --check` — passed.
- No native Rust behavior changed; no Windows GUI acceptance was performed.

## Handoff
- Clock remains an optional per-widget add-on from the card `+`; Tag Color Status can now control its availability globally or by tag color.
- Local commit only; not pushed. Verify the appearance in the live Windows app during integration.