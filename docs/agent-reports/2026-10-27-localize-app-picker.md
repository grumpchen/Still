# Task: Localize app picker

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized the app picker search, tabs, help copy, loading and empty states, selection status, and primary actions in English and Simplified Chinese.
- Kept the picker behavior and keyboard interactions unchanged.

## Files
- `still-desktop/src/AppWindowPicker.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the existing large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- Native error details and other low-use dialogs may still contain English. No live Windows UI acceptance was performed.
