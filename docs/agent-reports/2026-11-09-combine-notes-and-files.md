# Task: Combine Notes and Files

- Agent: Codex
- Time: 2026-11-09T01:15:19+13:00 (Pacific/Auckland)

## Done
- Renamed the Notes widget to Files in English and Simplified Chinese.
- Hid the standalone Files card from the Add Widget gallery and new-workspace picker. The combined card continues to use the existing Notes editor and folder explorer, including file previews and Markdown/text note editing.
- Kept the legacy Files widget type for existing Library folders, Downloads Inbox, saved layouts, and old workspace data.

## Files
- `still-desktop/src/domain/widgetCatalog.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `git diff --check` — passed.
- Native desktop visual verification — not performed.

## Handoff
- The standalone Files implementation remains available to Library internals and existing saved layouts; this change removes it from normal workspace creation. The combined Files card retains its internal `notes` type and uses the existing grant-bounded Notes Library explorer.
