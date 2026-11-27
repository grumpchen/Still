# Task: Align Dashboard editing and correct local assistant behavior

- Agent: Codex (gpt-6.2-sol)
- Time: 2026-11-27 Asia/Shanghai

## Done
- Dashboard editor and ordinary view share a responsive order-driven layout. Entering edit mode leaves automatic sizes responsive. Saved reorder and geometry remain the same after Done and reload.
- Still AI answers current Files folder and preview questions directly from the active widget. The reply distinguishes a browsed folder from a file genuinely open in preview.
- Bulk deletion with an exception resolves the keep set first and validates its exact deletion complement. It preserves the named widget type and locked widgets, and asks which widget to keep when the exception cannot be resolved. The original reported sentence now leaves AI Command intact and supports Undo.

## Files
- `still-desktop/src/DashboardHome.tsx`, `still-desktop/src/styles.css`
- `still-desktop/src/AssistantPanel.tsx`, `still-desktop/src/domain/assistant.ts`, `still-desktop/src/platform/currentFilesView.ts`, `still-desktop/src/useStillWorkbench.tsx`
- Assistant and Dashboard unit checks and focused Playwright flows under `still-desktop/tests`

## Checks
- TypeScript and production build passed. Full frontend unit suite passed 605/605.
- Full Chromium run passed 47/49. Two contrast tests selected both visible and hidden toolbar buttons. Updated the selectors to inspect the active toolbar and verified all 3 contrast cases on rerun.
- Playwright verified the reported bulk deletion prompt, retained AI Command, Undo, folder and preview answers, geometry parity at 1440px and 720px, and reorder persistence after reload.
- No Windows acceptance run for this local follow-up.

## Handoff
- The user explicitly asked to hold publication. The changes are committed locally while awaiting more instructions.
- This follow-up fixes the affected local paths. A model-led tool loop is a separate architecture decision.
