# Task: widget resize anchor

- Agent: Codex GPT-6
- Time: 2026-10-27T02:12:34+13:00 Pacific/Auckland

## Done
- Resize previews now scale from the top-left corner so the widget stays anchored while its bottom-right handle moves. The temporary transform origin is cleared after committing geometry.
- Kept the drag-release layout flush that prevents a widget from flashing to its original position before settling at the destination.
- Added regression coverage for anchored Notes resizing and the drag-release layout flush.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/tests/workspace-layout.test.mjs`

## Checks
- Focused canvas tests — 11 passed, 0 failed.
- `pnpm --dir still-desktop test` — 302 passed, 0 failed.
- `pnpm --dir still-desktop build` — passed; Vite reported the existing large-chunk warning.
- `git diff --check` — passed.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed. The resize fix was verified in the DOM regression test; a live desktop resize check was not performed.
