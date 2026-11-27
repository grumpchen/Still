# Task: Dashboard integration validation

- Agent: Codex (coordinator)
- Time: 2026-11-26T13:07:00+00:00

## Done
- Integrated Luna Dashboard, native runtime, Browser, and rule domain commits on the candidate branch; main is unchanged.
- Resolved Cargo feature overlap by retaining both `tray-icon` and `unstable`.
- Added independent recovery acceptance seeded from a previously active course, retaining the actual note document data across restart.
- Adapted the Dashboard shortcut test to the embedded Browser's Saved links drawer.
- Recorded independent production performance samples.

## Files
- `still-desktop/tests/e2e/workbench-recovery.spec.ts`
- `still-desktop/tests/e2e/dashboard-custom-layout.spec.ts`
- `docs/validation/dashboard-performance.json`

## Checks
- `pnpm check`, `pnpm build`: passed on integrated frontend.
- Dashboard custom/edit/layouts/smoke browser checks: 4 passed before embedded Browser integration.
- Updated Browser custom/edit checks: 2 passed; independent course recovery check: 1 passed after correcting the fixture to seed noteDocuments (the canonical Notes content).
- Native command permissions and rule domain: 8 passed, then rule follow-up: 9 passed; embedded Browser adapter plus permissions: 3 passed.
- Linux has no Cargo/rustc (`command not found`). Windows validation is running through GitHub Actions.

## Handoff
- Browser native lifecycle and exact Tauri signatures are still under review; no native GUI acceptance claim.
- Dashboard Today aggregation and concurrent edit preservation follow-up requested from Luna.
- This report records integration evidence, not completion of all three requested batches.
