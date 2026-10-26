# Task: drag snapback ordering

- Agent: Codex GPT-6
- Time: 2026-10-27T00:58:11+13:00 Pacific/Auckland

## Done
- Fixed the visible snap-back by applying the card's destination coordinates and dimensions before clearing its drag transform.
- Added a regression check for the ordering and retained the existing pointer-up geometry test.
- Restarted the native Still preview from the current checkout and confirmed its desktop window is open.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/tests/workspace-layout.test.mjs`

## Checks
- `pnpm test` — 300 passed, 0 failed.
- `pnpm check` — TypeScript check passed.
- Live drag was not reproduced via computer use because the Notes cards were not visible in the current canvas screenshot.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed. The latest native Still preview is running for a manual Notes drag check.
