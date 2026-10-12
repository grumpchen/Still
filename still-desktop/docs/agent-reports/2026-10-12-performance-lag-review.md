# Task: diagnose intermittent lag and improve workspace performance

- Agent: Codex
- Time: 2026-10-12T21:35:55+13:00 (Pacific/Auckland)

## Findings and changes
- No repeatable Windows interaction trace was available, so the reported intermittent freeze cannot yet be attributed to one runtime cause.
- Workspace startup parsed saved JSON twice. `load()` now decodes the stored profile once and passes that object to `parseState()`; string callers remain supported.
- Visited workspaces stay mounted to preserve native Browser and Apps attachments. Their Focus/Clock display timers previously continued updating while hidden. Timer UI ticks now pause for inactive workspaces and refresh immediately on activation; completed Clock timers are checked on activation and then once per second while active.
- General Settings now exposes 30 FPS, 60 FPS, and display-refresh choices for widget drag/resize. Pointer updates are coalesced and the final position is flushed on release.
- The full test run exposed an invalid test boundary: it sent Ctrl+M to a canvas-only harness even though the app shell owns keyboard shortcut handling. The failing assertion tried to format the large SVG node and exhausted Node's heap. The canvas test now checks its shortcut event; the separate shortcut tests cover Ctrl+M mapping.

## Files
- `src/App.tsx`
- `src/WorkspaceCanvas.tsx`
- `src/TimerWidget.tsx`
- `src/widgets.tsx`
- `src/domain/performance.ts`
- `src/domain/workspaces.ts`
- `src/GeneralSettings.tsx`
- `tests/timer-widget.test.mjs`
- `tests/widget-relaunch.test.mjs`
- `tests/workspaces-relaunch-migration.test.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd test` — 228 passed, 0 failed.
- `pnpm.cmd build` — passed; Vite completed in 0.984 seconds. The bundled leaf wallpaper is 2.86 MB before compression.
- `git diff --check` — passed.
- No release executable was produced.

## Runtime verification and limitations
- The Vite preview server remains available on `127.0.0.1:4318`; UI inspection found no controllable Still desktop window in this session. Therefore drag smoothness, workspace-switch timing, and native Browser/Apps attachment behavior were not measured live on Windows.
- The FPS control applies to widget drag/resize updates; it does not set a global WebView2 rendering frame cap.

## Further optimization candidates
1. Profile repeatable startup and workspace-switch scenarios with React Profiler plus native command timings. Separate app-shell updates from each canvas, since every previously visited workspace is kept mounted for native-session continuity.
2. Measure the cost of Liquid Glass wallpaper decode, backdrop filters, and widget shadows on the target GPU. If material, add an optional reduced-effects mode and ship a visually equivalent smaller wallpaper asset.
3. Measure JSON serialization and local document retention after large workspaces. If those dominate, move persistence off the UI thread or store workspace data incrementally; keep the current local format migration-safe.
4. For very large workspaces, evaluate viewport-based rendering for ordinary widgets while retaining native visibility management for Browser/Apps. This needs interaction and overlap tests before adoption.
