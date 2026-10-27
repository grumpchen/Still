# Task: localize calendar accessibility labels

- Agent: Codex GPT-6
- Time: 2026-10-27T23:28:23+13:00 (Pacific/Auckland)

## Done
- Localized the calendar time field, event-removal button, and marked-day screen-reader label in English and Simplified Chinese.
- Left calendar layout and event behavior unchanged.

## Files
- `still-desktop/src/CalendarWidget.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large JavaScript chunk advisory.
- Calendar translation-key coverage, including both locale entries — passed.
- `git diff --check` — passed.

## Handoff
- No live screen-reader or Windows UI acceptance was performed.
