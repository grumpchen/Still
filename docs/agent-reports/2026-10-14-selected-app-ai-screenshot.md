# Task: selected app AI screenshot

- Agent: Codex
- Time: 2026-10-14 21:54 +13:00

## Done
- When workspace screenshot sharing is enabled and the user @-selects one Apps, Files, or Calculator widget, Still now sends that visible widget image, including the attached native app pixels when available.
- Updated sharing text to explain the selected-widget behavior and updated assistant metadata to allow reading only visible, legible screenshot content.
- The `@All widgets` selection continues to send the workspace screenshot.

## Files
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/tests/assistant-panel.test.mjs`

## Checks
- Regression test first failed with `appRegion: null`, reproducing the missing native pixels; it now passes with the selected app region included.
- `node --test tests/assistant.test.mjs tests/assistant-panel.test.mjs` — 33 passed.
- Re-ran `node --test tests/assistant-panel.test.mjs` after the final selection adjustment — 2 passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- `pnpm check` — passed.
- `git diff --check` — passed.

## Handoff
- Frontend hot reload should apply this change in the live preview. Native app capture still requires a visible attached app and a Windows Still build; live Windows acceptance was not performed here.
