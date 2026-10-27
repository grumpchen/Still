# AI reviewed resource filing

## Decision

Still AI may suggest one destination folder for a file the user explicitly selected in a Files widget. It never receives an absolute filesystem path and never moves or deletes anything itself. Still shows the file name, proposed relative folder, and reason in a review card. The user must press **Move file** before Still changes the filesystem.

The native move command is scoped to the existing folder grant for that Files widget. It rejects traversal, links, blocked program files, unsafe Windows folder names, and collisions. It creates destination folders only after approval, never replaces an existing item, and leaves the source in place if the drive cannot perform a safe move. The model supplies only the destination folder and reason; the selected file path and widget grant remain app-owned.

The Downloads Inbox remains at `Documents/Still/Downloads` and Still continues to display that location with instructions for the user to change their browser's download setting. Still does not change Windows or browser preferences automatically. Files the user does not want remain in the inbox for ordinary user handling; this feature does not add AI deletion.

## Options considered

1. Parse a destination from ordinary AI prose. Rejected because prose is ambiguous and makes review and path validation unreliable.
2. Let the model issue native file commands. Rejected because model output must not directly mutate local files.
3. Return a structured, non-destructive folder proposal and require a user action in Still. Chosen because it is easy to inspect, compatible with all current providers, and keeps filesystem authority in the native Files service.

## Delivery stages

1. Add the native within-grant move primitive and its collision/path protections.
2. Add a bounded structured AI filing proposal and show it only for an explicitly selected native Files item.
3. Wire the confirmation card to the native move, preserve file notes at the new relative path, refresh the Files widget, and localize the new UI.

## Acceptance evidence

- Native verification proves nested destination creation and move, source removal, traversal and unsafe-name rejection, blocked-file rejection, and collision preservation.
- Frontend and provider-schema validation prove a filing proposal contains only a safe relative folder and bounded reason.
- The AI confirmation card is the only path to the new move action, and the native command independently checks its grant and filesystem paths.
- English and Simplified Chinese labels cover the review and completion states.
