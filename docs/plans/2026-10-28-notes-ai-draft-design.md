# Notes AI draft review

## Goal

Let users turn Still AI's explanation, summary, flashcards, quiz, or outline response into note content without silently changing their existing note.

## Interaction

- Notes AI actions attach the selected note's stable widget and document IDs plus the exact source text used for the request.
- The assistant shows the returned text in a read-only draft preview. The user can replace the note, append the draft, or cancel.
- A replacement or append is rejected if the note changed after the AI request. Text remains subject to the existing note-size limit.

## Write path

- The AssistantPanel sends a short-lived in-process request event to the matching Notes widget. The widget owns persistence because it also owns the local note save queue and library baseline.
- Before a library-backed write, flush pending saves, re-check the selected document, then use the native Notes Library write command with its expected-content baseline. Update that baseline only after the write succeeds.
- Local notes update workspace state directly. Both paths update the selected note document and widget text consistently.
- No AI response is automatically inserted. No file or workspace action is mixed into the note draft review.

## Boundaries

- The assistant response remains in its normal local chat history; the note itself changes only after confirmation.
- Confirmation applies only while the target widget/document still exists and matches the captured source text.
- English and Simplified Chinese receive translated review controls and errors.
