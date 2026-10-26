# Task: drag release glitch

- Agent: Codex GPT-6
- Time: 2026-10-27T00:29:56+13:00 Pacific/Auckland

## Done
- Kept the drag transform active until the final geometry is written to the card, then cleared it before React commits the saved placement. This prevents a visible jump back to the old position on release.
- Applied the same release ordering to ordinary moves, resizes, cancellations, workspace transfers, snap placement, and Group/tray drops.
- Extended the Notes drag regression check to verify destination geometry is present before the state update.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/tests/workspace-layout.test.mjs`
- `still-desktop/tests/native-group-drag.test.mjs`

## Checks
- `node --test tests/workspace-layout.test.mjs tests/native-group-drag.test.mjs` — 12 passed, 0 failed.
- `pnpm test` — 299 passed, 0 failed.
- `pnpm build` — TypeScript check and production build passed; existing large-chunk warning remains.
- Live Windows verification was unavailable because the Still window could not be targeted by the desktop tester.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed. Recheck Notes drag release in the live Windows app.
