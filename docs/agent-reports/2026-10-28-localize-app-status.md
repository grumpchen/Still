# Task: Localize app and workspace status messages

- Agent: Codex
- Time: 2026-10-28T00:36:20+13:00 (Pacific/Auckland)

## Done
- Localized static workspace, keyboard, click-through, widget-management, sidebar-plugin, and app-panel error/status messages.
- Localized the remaining static app-panel and AI-settings load errors found in the source audit.
- Left dynamic native error details intact so users can still see the underlying cause.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported a JavaScript chunk above 500 kB.
- `git diff --check` — passed.
- Static `notify`/`setError` string scan — no untranslated literal messages found in TSX.
- Manual UI verification — not run in this turn.

## Handoff
- Dynamic error details and other visible copy outside static notifications still need a broader localization review.
