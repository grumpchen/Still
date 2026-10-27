# Task: Notes AI draft review

- Agent: Codex GPT-6
- Time: 2026-10-28T00:10:14+13:00

## Done
- Notes AI actions now attach the target widget, document, and exact source text to the request.
- Generated study content appears in a read-only review card with Replace, Append, and Cancel actions. AI generated `edit_widget` text for the selected note follows the same review path.
- Applying a draft checks note identity, captured text, per-note and total note size limits, and—when library-backed—flushes pending saves and writes through the native baseline-protected Notes Library command.
- Stale or unavailable notes reject the write. A successful library write updates the in-memory baseline so a later autosave cannot reuse an outdated baseline.
- Added English and Simplified Chinese labels and error messages. The AI response remains in local chat history; note content changes only after explicit confirmation.

## Files
- `still-desktop/src/NotesWidget.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/assistant.css`
- `still-desktop/src/localization.tsx`
- `docs/plans/2026-10-28-notes-ai-draft-design.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-bundle advisory.
- `git diff --check` — passed.
- Tests were not run; the current instruction says not to run tests unless requested.
- Live Windows UI and native file-write interaction were not exercised.

## Handoff
- Next plan slices: built-in sidebar study utilities, then audit remaining localization/settings coverage and compact minimized-widget tags. The Dashboard remains a separate fixed layout from ordinary widgets.
