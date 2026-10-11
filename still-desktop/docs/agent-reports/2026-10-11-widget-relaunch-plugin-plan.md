# Task: widget relaunch plugin plan

- Agent: Codex (GPT-6)
- Time: 2026-10-11T18:19:56+13:00

## Done
- Inspected current workspace persistence, startup rendering, native Browser/Apps lifecycle, settings, plugin storage, and existing relaunch tests.
- Wrote a focused implementation plan. No application code was changed.

## Files
- `still-desktop/docs/plans/2026-10-11-widget-relaunch-plugin-plan.md`
- `still-desktop/docs/agent-reports/2026-10-11-widget-relaunch-plugin-plan.md`

## Checks
- Static inspection only; no tests run because this task produced a plan, not an implementation.

## Handoff
- Plan assumes the optional Tag Color Status widget is a standalone workspace card with composable built-in widget-plugin controls. Global mode defaults to Automatic for compatibility. Implementation should begin with policy and migration tests, then startup gating.
