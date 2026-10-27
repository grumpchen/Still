# Task: Localize web and status widgets

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized web shortcut editing and ordering, the calculator and assistant widget entry points, and Tag Color Status controls in English and Simplified Chinese.
- Preserved all widget actions and keyboard behavior.

## Files
- `still-desktop/src/WebWidget.tsx`
- `still-desktop/src/widgets.tsx`
- `still-desktop/src/TagColorStatusWidget.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- Literal translation key coverage for the touched widgets: no missing entries.
- `git diff --check` passed.

## Handoff
- Some native errors and lower-use widget content may remain English-only. No live Windows UI acceptance was performed.
