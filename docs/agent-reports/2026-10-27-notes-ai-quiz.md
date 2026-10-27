# Task: notes-ai-quiz

- Agent: Codex GPT-6
- Time: 2026-10-27T23:14:00+13:00

## Done
- Added a Notes AI action that drafts five practice questions with a separate answer key and explanations.
- Added English and Simplified Chinese prompts based on the selected note and active locale.
- The action sends context to the assistant; it does not modify the note.

## Files
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (640.67 kB).
- `git diff --check` — passed.

## Handoff
- The practice quiz is generated in the AI conversation; saving it into a note remains a deliberate user action.
