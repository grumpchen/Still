# Task: Flashcard plugin

- Agent: luna_browser
- Time: 2026-11-28T06:03:34+00:00 (UTC)

## Done
- Added a Notes-only Flashcards add-on, editable AI card preview, saving, review/reveal, again/remembered actions, AI explain/hint entry, source navigation handoff, and deck removal.
- Added bounded deck/card validation and persistence on Notes widgets plus an independent workspace-scoped localStorage store so a deck can remain available after its source widget is removed.
- Added English and Simplified Chinese labels.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/FlashcardsPlugin.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/domain/flashcards.ts`
- `still-desktop/src/domain/flashcardStorage.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/domain/widgetAddons.ts`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/assistant.css`
- `still-desktop/src/styles.css`
- `still-desktop/tests/flashcards.test.mjs`
- `still-desktop/tests/widget-color-tag.test.mjs`

## Checks
- `pnpm check` passed.
- `pnpm exec tsx --test tests/flashcards.test.mjs tests/widget-color-tag.test.mjs` passed (4 tests).
- The first full suite run reported 607/609 passing; both failures were exposed by the new Notes add-on/orphan deck assertions. They were corrected, and the focused tests pass. A full suite rerun remains pending.

## Handoff
- Notes toolbar trigger and stale-safe save/source listeners are being added by `luna_library` on its formatting branch. The expected trigger is `still-create-flashcards` with `{widgetId,noteId,title,text,modeContext?}`; save is `still-notes-save-flashcards` with `{workspaceId,widgetId,noteId,expectedText,deck,resolve,reject}`; navigation is `still-notes-navigate-source` with `{widgetId,noteId,quote}`.
- `AssistantPanel` writes to the workspace-scoped durable store after the Notes listener resolves successfully, then dispatches `still-flashcards-updated` with `{workspaceId}`. The Notes listener only needs to persist the deck on the validated widget and resolve the receipt.
- A missing source note does not block reviewing a stored deck; source navigation is disabled when the source is unavailable.
