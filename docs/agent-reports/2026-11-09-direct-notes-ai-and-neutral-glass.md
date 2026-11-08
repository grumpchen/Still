# Task: Direct Notes AI actions and neutral glass UI

- Agent: Codex (GPT-6)
- Time: 2026-11-09T00:54:45+13:00, Pacific/Auckland

## Done
- Study with AI actions now queue an automatic submission after note context and provider models load. The note is sent as read-only context; responses go to chat and do not modify the note.
- Missing provider/model configuration reports an error instead of silently leaving a prompt in the composer.
- Removed the dangling JSX left where the explicit Library Save button was removed; the Reload from file action now only appears for a conflicted Library-backed note.
- Replaced the green Liquid Glass surfaces and fallback colors with neutral gray surfaces. The AI sidebar and message cards are light, translucent glass in dark mode.

## Files
- still-desktop/src/NotesWidget.tsx
- still-desktop/src/AssistantPanel.tsx
- still-desktop/src/assistant.css
- still-desktop/src/styles.css

## Checks
- `pnpm check` — passed.
- `git diff --check` — passed.
- Native window inspection confirmed the Still · Live Development process is from this checkout, but the loaded UI still showed the old Save button and a prefilled prompt after the source fix. Native behavior and updated styling are not yet verified; the window needs a reload/restart. It also showed a Library save failure, so its current note state should be protected before restarting.
- Automated tests not run.

## Handoff
- Reload or restart the dev window after preserving the current note, then verify that Save is absent, Reload from file only appears on a Library conflict, and each Study with AI action creates a chat response. Also verify the neutral translucent theme in the native window.
