# Task: Direct window capture plan

- Agent: Codex coordinator
- Time: 2026-10-08, Pacific/Auckland (UTC+13; exact time not recorded)

## Done
- Verified the requested attach-edge-r2 executable hash against the committed Phase 1 report and checked source history: last source change is `afe209e5e2fe319b13f88e218cd4d1435f432b57`; later attach-edge worktree changes are documentation only.
- Created `agent/codex/direct-window-capture` at that exact source baseline in `.worktrees/still-codex-direct-window-capture`.
- Traced the baseline's keyboard hooks, picker preparation, widget creation, transient attachment map, native direct attach, focus transitions and saved-state behavior. Inspected e04a45f only as reference; did not import it.
- Planned one feature using source-free exact HWND/PID attachment, passive click observation, capture-specific focus handling, deduplication, lazy saving and bounded failure diagnostics. No application source changed.

## Files
- `docs/plans/2026-10-08-direct-window-capture.md`.
- This report.

## Checks
- Baseline executable SHA-256: `3E098E5719DEDE0A2AEBCD26AC722CDD41184CA2B5C385941CD529598CA06A6A` (matches report).
- Source diff from `afe209e` to attach-edge worktree HEAD `e769413`: documentation files only.
- Fresh branch/worktree creation succeeded at exact baseline.
- Source inspection confirms baseline global mouse capture/listener absent; executable preparation fails before direct attach when identity is missing; direct attach accepts identity without executable but explicitly activates Still; maximized normalization can also return focus to Still.
- No tests, executable launch or build: planning-only instruction. Live event/focus verification is pending implementation.

## Handoff
- PLAN COMPLETE. Recommend GPT-6 Luna High implementation; moderate-to-high native focus/race difficulty. Sol remains appropriate for scoped difficult-debugging review only.
- Preserve all prior branches/builds and shared uncommitted work. No geometry, containment, Group, tray, white-stripe or Phase 2.5 changes authorized by this plan.
- Wait for the user's implementation instruction. After a single test candidate is produced, stop for Windows acceptance.
