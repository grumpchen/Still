# Task: suite failures

- Agent: Codex GPT-6
- Time: 2026-10-26T23:37:44+13:00 Pacific/Auckland

## Done
- Updated stale tests and fixtures for the current Notes document model, workspace schema, settings UI, and Apps native-panel lifecycle.
- Removed Browser-widget-only UI tests and the unused Chrome-overlay geometry module; retained coverage for legacy Browser bookmark migration and safe URL handling.
- Fixed the layout test harness to use matching DOM events and cancel pending animation frames during teardown.

## Files
- `still-desktop/tests/`
- `still-desktop/src/domain/chromeOverlay.ts` (removed unused module)

## Checks
- `pnpm test` — 298 passed, 0 failed.
- `pnpm build` — TypeScript check and production build passed.
- Focused regression tests for Groups, native Apps, and canvas layouts — 32 passed, 0 failed.

## Handoff
- Changes committed on `agent/codex/notes-library`; not pushed.
- Browser widget UI remains retired; compatibility and safe URL migration coverage remains.
