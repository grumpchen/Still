# Task: First-run tutorial

- Agent: Codex, GPT-6
- Time: 2026-10-14T09:29:39+13:00

## Done
- Added a four-step first-run tour covering widget movement and drag targets, live keyboard shortcuts, the configured right-click minimize gesture, and Still AI.
- The tour opens once per local profile, can be replayed from General Settings, and can hand off to the AI assistant from its final step.
- Shortcut labels reflect the user's saved bindings; no workspace schema change is needed.

## Files
- `src/GettingStartedTour.tsx`
- `src/App.tsx`
- `src/GeneralSettings.tsx`
- `src/styles.css`
- `tests/getting-started-tour.test.mjs`

## Checks
- `node --test tests/getting-started-tour.test.mjs` — passed (2 tests).
- `pnpm check` — passed.
- `pnpm build` — passed with the existing large JavaScript chunk advisory.
- `git diff --check` — passed.

## Handoff
- The first-run completion flag is local to the device and separate from workspace backups.
- Full frontend tests still have 31 unrelated failures; live Windows acceptance has not been performed.
