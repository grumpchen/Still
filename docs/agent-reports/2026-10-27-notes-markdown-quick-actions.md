# Task: notes-markdown-quick-actions

- Agent: Codex GPT-6
- Time: 2026-10-27T21:50:00+13:00

## Done
- Added one-click Markdown heading, bullet-list, checklist-item, and bold formatting to Notes.
- Formatting works on the selected text or inserts at the current line/caret, then restores the editor caret. Existing local and library-backed save behavior is reused.

## Files
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/styles.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-chunk advisory (612.12 kB JS).
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- This is a focused Notes improvement, not completion of the Notes phase. Next expand study-specific AI actions and resource backlinks while keeping previews and writes explicit.
