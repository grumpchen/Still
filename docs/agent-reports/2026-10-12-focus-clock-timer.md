# Task: Focus clock add-on and workspace timer status

- Agent: Codex
- Time: 2026-10-12T17:12:24+13:00

## Done
- Restyled Focus with the shared analog duration dial and added Clock as a saved per-widget add-on, opened from a floating panel that follows its card.
- Persisted Clock add-on selection and timer duration in workspace and tray shortcut state; added red workspace status when Focus or Clock timers finish.
- Applied a 4px horizontal workspace scrollbar and brightened dial numerals.

## Files
- `still-desktop/src/TimerWidget.tsx`, `WorkspaceCanvas.tsx`, `canvas.css`, `Icon.tsx`, `widgets.tsx`
- `still-desktop/src/domain/workspaces.ts`, `presets.ts`, `widgetCatalog.ts`
- Focused timer and rendered widget tests; registry-based inline-tray assertion

## Checks
- `pnpm check` — passed.
- `pnpm test` — 202 passed, 0 failed.
- Focused timer/rendered add-on tests after the final assertions — 19 passed, 0 failed.
- `pnpm build` — passed (Vite production build).
- `git diff --check` — passed.
- Windows GUI behavior and scrollbar appearance — not verified in a live desktop session.

## Handoff
- No Rust/native-window changes. No executable built, pushed, or released.
