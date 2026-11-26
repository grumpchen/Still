# Task: workbench dispatch

- Agent: luna_regressions
- Time: 2026-11-26 UTC (timezone displayed by the execution environment)

## Done
- Added a dependency injected workbench service for all workspaces' Files, saved links and layout metadata; strict single mutation dispatch uses the shared collection operation service.
- Added layout and resource queries. Resource search includes folder grants, PDF references, saved Group links and in-canvas Group widget links, and reports unavailable grants and native search truncation.
- Added an automation adapter with exact capture event lookup and locator checks, shared collection operations for links/PDF references, an explicit non-activating layout handler, and a durable idempotency journal that records running before mutation and never replays ambiguous work.
- Added workbench dispatch tests that exercise the real collection reducer, persisted in-memory host, exact link capture movement, restart replay, concurrent deduplication, unknown outcomes, and rule-save results.

## Files
- `still-desktop/src/platform/workbenchOperations.ts`
- `still-desktop/tests/workbench-operations.test.mjs`

## Checks
- `pnpm check` passed.
- `node --import tsx --test --test-concurrency=1 tests/workbench-operations.test.mjs`: 8 passed.
- Full `pnpm test`: 545 passed, 1 failed in existing `assistant-library-tools.test.mjs` at line 29 (`undefined == true`). This test was not changed by this task.

## Handoff
- App wiring: pass `getState`, `commitState`, `getLayouts`, `layoutHandlers`, `collection: executeCollectionOperation`, `saveRule: createFromText`, `getCaptureEvent: id => automationCaptureInbox.get(id)`, `getCourses`, and `searchFiles: localFiles.searchLibrary`. The search callback is called with `localFiles` as `this` for the direct method reference.
- Manual `layout.apply` uses `layoutHandlers.apply`; scheduled automation uses the optional `layoutHandlers.prepare` and falls back to `apply` only when omitted. Supply an automation-specific wrapper that invokes the same global layout application logic without activating/switching workspaces.
- Capture file action uses `file.moveReference` after validating the exact PDF sourceId; this commit's base did not yet contain the Library worker's `file.moveReference` type/implementation, so the narrow mapping uses a cast until that commit is integrated. Folder captures and legacy free-form link origins return clarification.
- `getCourses` should return the current catalog with course ID/workspace ID pairs; without it, capture filing safely returns clarification.
