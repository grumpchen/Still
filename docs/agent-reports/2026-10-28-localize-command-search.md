# Task: Localize command search

- Agent: Codex
- Time: 2026-10-28T00:28:41+13:00 (Pacific/Auckland)

## Done
- Localized command-search labels and workspace names in English and Simplified Chinese.
- Removed canvas-only Add widget and Arrange workspace commands while Dashboard or Library is active.
- Kept keyboard shortcut handlers unchanged.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported a JavaScript chunk above 500 kB.
- `git diff --check` — passed.
- Manual UI verification — not run in this turn.

## Handoff
- Continue auditing visible English-only strings in the app and localize high-visibility workspace controls and feedback.
