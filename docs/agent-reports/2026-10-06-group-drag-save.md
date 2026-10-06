# Task: group drag-save

- Agent: Codex, GPT-6
- Time: 2026-10-06T21:13:49+13:00

## Done
- Added a Group-save drop target to the existing Group tray button and existing named Group buttons/expanded shelves. Saving creates or appends a reusable entry and keeps the source widget open at its original placement.
- Hid Assistant from the main widget tray while retaining the `ai` widget type, renderer, and other entry points.
- Added green feedback for Group targets; preserved empty-tray removal and existing preset/external-drop behavior.
- Work is isolated on `agent/codex/group-drag-save` from clean base `25451ff72069b7462fe5f96c651b8bd79fa75565`. No changes were made in OC's worktree.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/GroupTray.tsx`
- `still-desktop/src/App.tsx`
- `still-desktop/src/domain/trayDrop.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/trayDrop.test.mjs`
- `still-desktop/tests/group-tray.test.mjs`

## Checks
- Baseline frontend suite before edits: 54 passed, 0 failed.
- TDD targeted Groups/tray tests: initially failed on missing group-drop actions/helper; passed after implementation (15 passed, 0 failed).
- Full frontend suite: 56 passed, 0 failed.
- `corepack pnpm check`: passed.
- `corepack pnpm build`: passed.
- `git diff --check`: passed.
- Native desktop runtime/UI drag test not run; no Tauri executable was launched.

## Handoff
- Phase 2 does not alter OC's working tree or interrupt its build. Integration has a known overlap in `WorkspaceCanvas.tsx`; integrate only after Phase 1 is accepted, then resolve that file against its final baseline. The shared root also has pending Phase 1-related changes in `App.tsx` and `domain/workspaces.ts`; preserve them during integration.
- Existing `GroupWidgetEntry` stores only type/name/icon. Saved entries create fresh default instances; live widget state is intentionally not cloned.
- Changes remain uncommitted for the integration owner.
