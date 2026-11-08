# Task: Direct Notes AI actions and neutral glass UI

- Agent: Codex (GPT-6)
- Time: 2026-11-09T01:06:57+13:00, Pacific/Auckland

## Done
- Study with AI actions automatically submit after the selected note context and provider models load. The note is read-only context; the response goes to chat and does not modify the note.
- Automatic study instructions are hidden from the composer and conversation display, but retained in saved provider history for follow-up context. Existing generated study prompts in chat history are hidden as well.
- Duplicate trailing JSON echoes are removed only when they exactly repeat the preceding assistant response.
- Missing provider/model configuration reports an error instead of silently leaving a prompt in the composer.
- Removed the dangling JSX left where the explicit Library Save button was removed; Reload from file appears only for conflicted Library-backed notes.
- Replaced Liquid Glass green surfaces and fallback colors with neutral gray surfaces. The AI sidebar and message cards use light translucent glass in dark mode.

## Files
- still-desktop/src/NotesWidget.tsx
- still-desktop/src/AssistantPanel.tsx
- still-desktop/src/assistant.css
- still-desktop/src/styles.css
- still-desktop/src/domain/assistant.ts
- still-desktop/src/domain/assistantChat.ts

## Checks
- `pnpm check` — passed.
- `git diff --check` — passed.
- Restarted the native Still dev app from this checkout. Study with AI submitted without a Send click; the provider returned an answer; the instruction is hidden and the composer is clear. The selected note was empty, and the visible response correctly asked for note text.
- The previous Library-backed note now reports Saved locally; the removed Save control is absent.
- Automated tests not run. Native visual inspection of the updated glass colors remains pending.

## Handoff
- Verify the light neutral glass styling visually in the native window and try a non-empty Library note for a content-bearing explanation.
