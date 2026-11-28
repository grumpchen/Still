# Task: Workbench parity

- Agent: Codex (GPT-6)
- Time: 2026-11-28 (UTC; exact completion time unavailable)

## Done
- Added structured Dashboard module list/add/remove/reorder/resize operations, Group list/create/rename/delete operations, and Automation Rule list/enable/layout-mode/delete/run-due operations to the Workbench action contract and dispatcher.
- Routed rule administration through the mounted automation runner callbacks and exposed bounded Dashboard, Group, and rule metadata in provider context.
- Updated the Rust provider protocol/schema and assistant guidance to support the new structured operations.
- Synced Dashboard Home from persisted module layout changes made through Workbench actions.

## Files
- `src/domain/workbenchActions.ts`
- `src/domain/workbenchContext.ts`
- `src/platform/workbenchOperations.ts`
- `src/useStillWorkbench.tsx`
- `src/DashboardHome.tsx`
- `src-tauri/src/assistant_protocol.rs`
- `tests/workbench-parity.test.mjs`

## Checks
- `pnpm exec tsx --test tests/workbench-parity.test.mjs tests/workbench-actions.test.mjs tests/workbench-operations.test.mjs tests/workbench-context.test.mjs` — passed, 28 tests.
- `pnpm check` — passed.
- `git diff --check` — passed.
- Rust protocol tests not run: `cargo` is not installed in this environment.

## Handoff
- Workbench structured actions now cover Dashboard edits, Groups, and Automation Rule administration. Destructive Group deletion requires explicit `removeContents: true`; otherwise nonempty groups produce a clarification. Dashboard removals hide modules while preserving underlying widget data.
- Files UI navigation/preview transient controls and agent-preview bridging remain owned by the coordinator; manual UI integration and release validation remain outside this branch. Rust tests should be run where Cargo is available.
