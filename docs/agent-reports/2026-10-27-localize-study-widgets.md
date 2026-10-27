# Task: Localize study widgets

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized the Focus timer, file browser, and document preview labels, controls, statuses, and notes fields in English and Simplified Chinese.
- Kept timer actions, file handling, and widget shortcuts unchanged.

## Files
- `still-desktop/src/TimerWidget.tsx`
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/DocumentWidget.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- Native error details and some remaining app/widget copy may still be English. No live Windows UI acceptance was performed.
