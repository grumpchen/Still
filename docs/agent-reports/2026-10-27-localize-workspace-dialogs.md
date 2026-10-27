# Task: Localize workspace dialogs

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized the workspace create and rename dialogs, command search, app attachment dialog labels, keyboard shortcuts dialog title, and modal close label in English and Simplified Chinese.
- Kept existing keyboard interactions and shortcuts unchanged.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the existing large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- The app window picker body and several lower-use dialogs still contain English-only text and remain follow-up localization work. No live Windows UI acceptance was performed.
