# Task: Localize layout and canvas prompts

- Agent: Codex
- Time: 2026-10-28T00:31:21+13:00 (Pacific/Auckland)

## Done
- Localized the snap layout picker, layout names, snap zones, Snap Assist prompts, and empty canvas state in English and Simplified Chinese.
- Localized saved-shortcut section labels, shortcut accessibility names, widget lock/remove/relaunch controls, minimap title, and regular workspace action bar labels.
- Kept layout placement, shortcut, and widget action handlers unchanged.

## Files
- `still-desktop/src/SnapLayoutOverlay.tsx`
- `still-desktop/src/PresetTray.tsx`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/localization.tsx`

## Checks
- `pnpm --dir still-desktop check` — passed.
- `pnpm --dir still-desktop build` — passed; Vite reported a JavaScript chunk above 500 kB.
- `git diff --check` — passed.
- Manual UI verification — not run in this turn.

## Handoff
- English-only dynamic AI confirmation messages remain in `AssistantPanel.tsx` and app action results. Continue the localization audit there and across error feedback.
