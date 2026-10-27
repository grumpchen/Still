# Task: Localize operational feedback

- Agent: Codex
- Time: 2026-10-28T01:10:55+13:00

## Done
- Added a shared English-to-Simplified-Chinese formatter for fixed application status and error prefixes while leaving unknown diagnostic details intact.
- Applied it to application notifications, Assistant errors, and Notes Library errors.
- Covered startup settings, click-through, fullscreen, native app handling, workspace/file changes, AI layout, and Notes Library save feedback.
- Preserved all operation behavior, shortcuts, and widget controls.

## Files
- `still-desktop/src/localization.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/NotesWidget.tsx`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported the existing large-chunk advisory.
- `git diff --check` — passed.
- Tests and live Windows language-switch acceptance were not run.

## Handoff
- Unknown native diagnostic text is intentionally retained after localized prefixes. Continue the broader UI localization audit and verify language switching in the Windows app.
