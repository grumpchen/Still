# Task: Localize widget and plugin dialogs

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized the add-widget gallery and its widget descriptions in English and Simplified Chinese.
- Localized the Stack and Layout sidebar-plugin dialog, including descriptions and added states.
- Localized the group editor fallback title.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- Other less-used settings and editor dialogs still need a language-coverage pass. No live Windows UI acceptance was performed.
