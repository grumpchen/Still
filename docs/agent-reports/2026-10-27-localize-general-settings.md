# Task: localize-general-settings

- Agent: Codex GPT-6
- Time: 2026-10-27T22:30:00+13:00

## Done
- Localized the General Settings controls and descriptions in English and Simplified Chinese, including startup, performance, workspace-following, click-through, app shutdown, and widget button options.
- Kept all existing keyboard shortcut bindings and behavior unchanged.

## Files
- `still-desktop/src/GeneralSettings.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (628.29 kB).
- `git diff --check` — passed.

## Handoff
- Appearance, shortcut editor, plugins, AI action confirmations, and less-used dialogs still include untranslated copy.
