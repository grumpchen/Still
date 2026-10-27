# Task: localize-widget-plugin-settings

- Agent: Codex GPT-6
- Time: 2026-10-27T22:45:00+13:00

## Done
- Localized built-in widget plugin names, descriptions, settings, and status messages.
- Localized global/tag-color widget relaunch choices and priority guidance.
- Preserved plugin state and settings behavior.

## Files
- `still-desktop/src/WidgetPluginsSettings.tsx`
- `still-desktop/src/WidgetRelaunchScope.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (635.69 kB).
- `git diff --check` — passed.

## Handoff
- Lower-use plugin status controls and several secondary dialogs remain English-only.
