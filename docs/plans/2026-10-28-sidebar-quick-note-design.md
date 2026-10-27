# Sidebar Quick Note

## Goal

Make note capture available from the auto-hiding app-style sidebar, regardless of the current workspace.

## Interaction

- A bilingual Quick note action creates a blank document in the fixed Dashboard Notes module and switches to Dashboard.
- The created note becomes the selected note. Existing notes are kept; the existing per-widget open-note limit is respected with a clear message.
- The creation is a normal workspace state change and uses the existing undo snapshot.

## Data and boundaries

- Store the document in the Dashboard's existing Notes widget so Notes autosave, local persistence, and library features continue to apply.
- Do not create a new Notes widget or a separate capture store.
- If Dashboard or its fixed Notes module is unavailable, report that state without changing workspaces.
