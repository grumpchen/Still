# Task: Remove vertical canvas extension

- Agent: Codex
- Time: 2026-10-08T00:45:41+13:00

## Done
- Limited workspace canvas height to the visible viewport height instead of 150%.
- Kept horizontal canvas extension unchanged at 150%. Existing placement bounds clamp widgets into the reduced vertical area.

## Files
- `still-desktop/src/domain/layout.ts`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `docs/agent-reports/2026-10-08-remove-vertical-canvas-extension.md`

## Checks
- `corepack pnpm build` — passed (TypeScript and Vite production build).
- `corepack pnpm tauri build --no-bundle` — passed.
- Live UI acceptance — not run.

## Handoff
- Test candidate: `still-desktop/src-tauri/target/release/ver0.21-test-vertical-canvas.exe`.
- Based on `907503b391b7ccb5c9fe41baf6bb46494928ff6d`, including the Browser host resize fix.
