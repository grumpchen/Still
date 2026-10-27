# Task: Localize canvas and sidebar controls

- Agent: Codex GPT-6
- Time: 2026-10-28T00:18:25+13:00

## Done
- Localized core workspace canvas labels, group creation, widget move/resize/restore and plugin controls, tag-color actions, screenshot/export controls, and related accessibility hints in English and Simplified Chinese.
- Localized sidebar Stack, Layout, add-plugin, fullscreen, timer status, profile, and settings-tab labels.
- Kept shortcut bindings and keyboard interactions unchanged; only user-facing labels and help text changed.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-bundle advisory.
- `git diff --check` — passed.
- Tests were not run; the current instruction says not to run tests unless requested.
- Live Windows language-switch and keyboard interaction were not exercised.

## Handoff
- Several operational error notifications and drag-target hints in WorkspaceCanvas still contain English-only text. Continue the locale audit there, then check other remaining literal UI surfaces.
