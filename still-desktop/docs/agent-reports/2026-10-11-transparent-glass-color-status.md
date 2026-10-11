# Task: Transparent Liquid Glass and color status controls

- Agent: Codex
- Time: 2026-10-11T22:49:27+13:00 (Pacific/Auckland)

## Done
- Transparent workspace backgrounds now hide Liquid Glass’s fixed leaf wallpaper layer and clear the viewport/canvas while retaining the glass material on widgets.
- Replaced the always-visible seven-color relaunch list with an “All colors follow global” switch and an add-color dropdown. Selected color rules stack as rows, each can follow global/Automatic/Manual, and explicit values are summarized (for example, “Manual: Red”). Turning global back on clears the per-color overrides and rows.
- Kept status-card controls plugin-driven and moved the shared color list to a small standalone domain module to avoid expanding widget module dependencies.

## Files
- `src/styles.css`, `src/canvas.css`
- `src/WidgetPluginStatusControls.tsx`, `src/TagColorStatusWidget.tsx`
- `src/domain/widgetPlugins.ts`, `src/domain/widgetTags.ts`, `src/domain/workspaces.ts`
- `tests/app-settings.test.mjs`, `tests/widget-relaunch.test.mjs`
- `docs/plans/2026-10-11-liquid-glass-color-status.md`

## Checks
- `node_modules/.bin/tsc.cmd --noEmit` — passed.
- `node --test --test-name-pattern="Tag Color Status" tests/widget-relaunch.test.mjs` — 2 passed, 0 failed; covers the switch, adding stacked colors, summary, clearing overrides, and a newly registered plugin renderer.
- `node --test tests/app-settings.test.mjs tests/settings-dialog.test.mjs tests/workspaces-relaunch-migration.test.mjs` — 15 passed, 0 failed.
- Full focused suite — 17 passed, 9 failed. The failures share the Vite SSR transport timing out after 60 seconds while fetching `DocumentWidget.tsx` through the unrelated Files widget module graph; the two isolated Tag Color Status tests passed in that run.
- Vite production build and Tauri release build — passed. Standard `target/release/still-desktop.exe` was locked by a running process, so the successful build was placed at `src-tauri/target/glass-status-fix/release/still-desktop.exe` (15,257,600 bytes). The Tauri dependency-install hook reported a pnpm workspace-hoist warning but continued to the successful TypeScript/Vite and Rust builds.
- `git diff --check` — passed.
- Live Windows GUI behavior was not exercised; the executable was not run.

## Handoff
- Use the separately built executable while the previous one remains open. No push or merge was performed.
