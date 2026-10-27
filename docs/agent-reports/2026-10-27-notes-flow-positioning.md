# Task: Notes flow positioning

- Agent: Codex GPT-6 Luna
- Time: 2026-10-27T13:48:01+13:00 Pacific/Auckland

## Done
- Kept reflective Notes cards absolutely positioned so DOM reordering only changes stacking and does not move cards through document flow.
- Added a regression using the actual canvas stylesheet and two Notes cards; verified it fails with the previous cascade (`relative`) and passes with the fix (`absolute`).

## Files
- `still-desktop/src/canvas.css`
- `still-desktop/tests/workspace-layout.test.mjs`

## Checks
- `node --test tests/workspace-layout.test.mjs` — 12 passed, 0 failed.
- `git diff --check` — passed.
- Regression against previous CSS cascade — failed as expected: computed position was `relative`.
- `pnpm build` — passed; Vite reports the existing bundle-size warning.
- Native Still preview: moved Notes 2 and confirmed Notes 1 remained in place, then returned Notes 2 and restored the previous stacking order. The screenshots were taken after each drag; transient animation and resize were not separately captured.

## Handoff
- Changes remain on `agent/codex/notes-library`; the live preview hot-reloaded the CSS fix.
