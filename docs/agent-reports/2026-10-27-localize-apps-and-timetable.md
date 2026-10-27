# Task: Localize Apps and timetable widgets

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized the Apps widget states and actions and the weekly timetable editor in English and Simplified Chinese.
- Made the shared translation function stable by locale and ensured asynchronous Chrome launch feedback uses the current language.
- Preserved the app attachment controls, mouse gestures, and keyboard operations.

## Files
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/TimetableWidget.tsx`
- `still-desktop/src/TimerWidget.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- Literal translation key coverage for the touched widgets: no missing entries.
- `git diff --check` passed.

## Handoff
- Some lower-use widget and native error messages may remain English-only. No live Windows UI acceptance was performed.
