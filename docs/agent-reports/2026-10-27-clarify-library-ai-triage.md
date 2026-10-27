# Task: clarify-library-ai-triage

- Agent: Codex GPT-6
- Time: 2026-10-27T22:23:00+13:00

## Done
- Changed the selected-file AI prompt to suggest one of three outcomes: useful to file, needs review, or probably not needed.
- Required the assistant to explain its evidence, avoid guessing when context is insufficient, and recommend a course/topic/folder only for useful files.
- Made the suggested prompt follow the selected English or Simplified Chinese locale.
- Reiterated that classification is advice only; the file stays in the inbox until the user decides.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (624.31 kB).
- `git diff --check` — passed.

## Handoff
- AI still classifies one explicitly selected file at a time. Bulk review and file actions have not been added.
