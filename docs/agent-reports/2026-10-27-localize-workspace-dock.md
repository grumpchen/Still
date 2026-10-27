# Task: Localize workspace dock

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized the app and shortcut dock, including navigation, search, loading and empty states, refresh/remove/save controls, and accessible descriptions in English and Simplified Chinese.
- Dock behavior and keyboard interactions remain unchanged.

## Files
- `still-desktop/src/WorkspaceDock.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- Some widget internals and editor dialogs still contain English-only copy. No live Windows UI acceptance was performed.
