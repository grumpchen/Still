# Task: Direct Ctrl+Shift-click attachment plan

- Agent: Codex
- Time: 2026-10-08T20:49:16+13:00 (Pacific/Auckland)

## Done
- Trimmed the plan to passive Ctrl+Shift-click capture and direct attachment of the exact HWND/PID after mouse-up.
- Specified `appKey: null`, single-attachment deduplication, normal click/focus passthrough, modifier-release behavior, and minimal stage logging with visible failure feedback.
- Removed Save-to-tray, reusable shortcut, executable preparation, relaunch, and broad diagnostics work from implementation scope.

## Files
- `docs/plans/2026-10-08-direct-window-capture.md`
- `docs/agent-reports/2026-10-08-direct-window-capture-plan.md`

## Checks
- `git diff --check` — passed.
- Reviewed for source changes — none; no tests or build run because this task only trims the plan.

## Handoff
- Implementation baseline remains `afe209e5e2fe319b13f88e218cd4d1435f432b57` in the isolated `agent/codex/direct-window-capture` worktree.
- Await the user's implementation instruction; when authorized, produce one Windows test executable and stop for manual testing.
