# Task: Notes drag capture loss

- Agent: Codex GPT-6
- Time: 2026-10-27T01:48:35+13:00 Pacific/Auckland

## Done
- Pointer capture loss now completes a drag at its current pointer position instead of canceling and restoring the original placement. Window-level pointer-up and pointer-cancel listeners also finish gestures if the header stops receiving events.
- Added a Notes drag regression test for lost pointer capture and updated native group drag cleanup assertions.
- Dragged Notes 2 in the live Still desktop preview, switched to another workspace and back, and confirmed the new position persisted. Restored Notes 2 to its original position afterward.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/tests/workspace-layout.test.mjs`
- `still-desktop/tests/native-group-drag.test.mjs`

## Checks
- `pnpm --dir still-desktop exec node --test tests/workspace-layout.test.mjs` — 10 passed, 0 failed.
- Full Still test suite — 301 passed, 0 failed.
- `pnpm --dir still-desktop check` — passed.
- `git diff --check` — passed.
- Live desktop drag and workspace-switch persistence check — passed.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed. The native Still live preview remains open. The reported snap-back was not reproduced in the current preview after this fix.
