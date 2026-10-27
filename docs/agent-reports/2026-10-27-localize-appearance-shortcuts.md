# Task: localize-appearance-shortcuts

- Agent: Codex GPT-6
- Time: 2026-10-27T22:38:00+13:00

## Done
- Localized the appearance material, colour mode, spacing, background effects, and opacity controls.
- Localized shortcut descriptions, workspace controls, mouse-minimize instructions, and save/reset actions.
- Preserved shortcut bindings, key capture, mouse behavior, and plugin behavior.

## Files
- `still-desktop/src/AppearanceSettings.tsx`
- `still-desktop/src/ShortcutSettings.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large JavaScript chunk advisory (632.18 kB).
- `git diff --check` — passed.

## Handoff
- Plugin settings and several lower-use dialogs still contain English-only text.
