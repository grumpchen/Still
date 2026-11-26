# Task: final test contracts

- Agent: Luna regressions
- Time: 2026-11-26T14:20:24+00:00

## Done
- Replaced four stale source-string and void-return assertions with checks of current transfer, assistant removal, Group deletion and native release behavior.
- Kept coverage for follow-workspace preference, locked and running-widget preservation, manual confirmation of populated Groups, and close preference propagation.
- No application source changes.

## Files
- `still-desktop/tests/app-settings.test.mjs`
- `still-desktop/tests/assistant-sidebar.test.mjs`
- `still-desktop/tests/group-tray.test.mjs`
- `docs/agent-reports/2026-11-26-final-test-contracts.md`

## Checks
- `pnpm exec tsx --test tests/app-settings.test.mjs tests/assistant-sidebar.test.mjs tests/group-tray.test.mjs` — 39 passed.
- `pnpm test` — 583 passed, 0 failed.
- `git diff --check` — passed.

## Handoff
- The source integration checks deliberately track the current callback boundaries while behavior assertions exercise domain helpers and release results. No known remaining failures in this unit suite.
