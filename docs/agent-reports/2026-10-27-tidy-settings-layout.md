# Task: tidy-settings-layout

- Agent: Codex GPT-6
- Time: 2026-10-27T22:10:00+13:00

## Done
- Made the Settings dialog wider and height-bounded so long settings pages remain usable.
- Kept the settings tabs visible while each page scrolls independently.
- Added clearer section headings and tightened row spacing.

## Files
- `still-desktop/src/styles.css`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large JavaScript chunk advisory (619.15 kB).
- `git diff --check` — passed.

## Handoff
- Settings copy is not fully localized yet; remaining AI panel, dialogs, and less-used widget surfaces also need translation.
