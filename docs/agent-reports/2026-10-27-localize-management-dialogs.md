# Task: Localize management dialogs

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized saved shortcut management, preset editing, saved-item rename/removal confirmations, and the sidebar-plugin settings section in English and Simplified Chinese.
- Preserved all management actions and keyboard behavior.

## Files
- `still-desktop/src/App.tsx`
- `still-desktop/src/TrayEditor.tsx`
- `still-desktop/src/PresetEditor.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- Literal translation-key coverage for touched modules: no missing entries.
- `git diff --check` passed.

## Handoff
- Some low-use widget text and native error details may remain English-only. No live Windows UI acceptance was performed.
