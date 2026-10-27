# Task: Localize group editor and onboarding tour

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized saved Group editing, resource links, widget choices, empty state, and item actions in English and Simplified Chinese.
- Localized the onboarding tutorial, including keyboard and mouse shortcuts, in both languages. Shortcut behavior is unchanged.

## Files
- `still-desktop/src/GroupEditor.tsx`
- `still-desktop/src/GettingStartedTour.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- Some file, document, and web widget details remain English-only. No live Windows UI acceptance was performed.
