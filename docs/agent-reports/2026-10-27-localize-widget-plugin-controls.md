# Task: Localize widget plugin controls

- Agent: Codex
- Time: 2026-10-27 (Pacific/Auckland; time unavailable)

## Done
- Localized widget relaunch, screenshot, clock timer, tag-color rules, and lock controls in English and Simplified Chinese.
- Updated accessible labels and color names while preserving the existing settings and keyboard behavior.

## Files
- `still-desktop/src/WidgetPluginStatusControls.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm check` passed.
- `pnpm build` passed; Vite reported the large JavaScript chunk warning.
- `git diff --check` passed.

## Handoff
- Some editor and widget-body copy remains English-only. No live Windows UI acceptance was performed.
