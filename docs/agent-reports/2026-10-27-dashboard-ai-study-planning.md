# Task: dashboard-ai-study-planning

- Agent: Codex GPT-6
- Time: 2026-10-27T23:34:00+13:00

## Done
- Added a Dashboard action that opens Still AI with a seven-day study-planning prompt in the selected language.
- Included up to 80 validated calendar events in the AI workspace context as date, time, category, and title.
- Prompted AI to avoid conflicts, suggest manageable sessions and breaks, and ask one clarification if needed.
- Kept the feature suggestion-only; it does not add calendar entries or claim to.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (643.84 kB).
- `git diff --check` — passed.

## Handoff
- The user can add a suggested time to the calendar through the existing calendar form; AI does not write calendar events directly.
