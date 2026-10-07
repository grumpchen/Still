# Task: Reset current roadmap to Phase 1

- Agent: Codex, Sol planning session
- Time: 2026-10-08T10:13:37+13:00 (Pacific/Auckland)

## Done
- Updated the product roadmap to the user's four phases; Phase 1 is current, Phases 2–4 queued.
- Wrote a bounded Luna handoff for picker discovery/selection/attachment first, then contained layout, and a separate native right-edge hiding experiment.
- Inspected actual picker, attachment delivery, Browser/Apps geometry/queues/revisions, native refresh/show paths, Group drag/save, and existing shortcut/settings routes.
- No application source changed, no new build, no implementation started, no merge/push or executable launch.

## Files
- docs/plans/still-roadmap.md (current phase ordering and gates)
- docs/superpowers/plans/2026-10-08-phase1-attach-and-edge.md (Phase 1 implementation handoff)
- docs/agent-reports/2026-10-08-phase1-roadmap-reset.md

## Checks
- Verified clean task worktree before documentation edits: agent/codex/ui-cleanup, source HEAD 45410ae570c0b5a62ed9e9d867808adee299f757.
- Verified canonical shared checkout is a different dirty branch at 6fe5e999e00b32d49d643fbba8ccd7e091e3b287; left its files untouched.
- Reviewed current files and source/build reports; confirmed the UI-cleanup test executable exists.
- Self-reviewed roadmap for all user requirements, phase boundaries, ownership and Windows acceptance gates.
- Application tests not run: documentation-only planning. Neither attachment failure nor native compositor stripe was reproduced live in this turn. Proposed native mechanism remains an experiment, not a proven fix.

## Handoff
- PLAN COMPLETE. Recommended coding model: GPT-6 Luna High. Difficulty: medium/high. Sol reserved for unresolved native/compositor debugging.
- Luna should create its isolated Phase 1 worktree from the recorded source baseline, verify the actual failing build, and stop after one combined candidate at READY TO TEST.
- User will continue with Luna. NEXT ACTION: Waiting for user.
