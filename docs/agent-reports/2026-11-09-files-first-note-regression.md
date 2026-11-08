# Task: Files-first note regression coverage

- Agent: Codex (GPT-6.1)
- Time: 2026-11-09T06:30:00+13:00

## Done
- Replaced a stale test that expected the retired standalone Notes page with checks for the current folder-first Files default.
- Confirmed the disconnected Files state does not offer note creation outside a chosen folder, does not show the legacy editor page, and keeps existing local note data intact.
- Existing connected-folder coverage still checks multi-note tabs, editing, formatting, tags, links, and Study with AI actions.

## Files
- `still-desktop/tests/widget-relaunch.test.mjs`

## Checks
- Focused Files-first regression test — 1 passed (173 seconds, dominated by Vite test setup).
- In the preceding full `pnpm test` run, this test failed only because it expected the superseded Notes-first design. Other unrelated legacy UI assertions also failed; a full clean-baseline comparison was not run.

## Handoff
- Native application behavior was not changed. The active development preview remains on this checkout and was not restarted.
