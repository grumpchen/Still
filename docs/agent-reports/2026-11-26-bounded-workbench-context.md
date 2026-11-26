# Task: bounded workbench context

- Agent: Luna regressions
- Time: 2026-11-26T14:32:48+00:00

## Done
- Bound workbench directory metadata to 20,000 UTF-8 bytes and recent receipts to four entries/eight result rows each with a 6,000-byte cap.
- Preserve every workspace ID. When directory entries are omitted, include `directoryTruncated`, omission counts, and a notice to use `resource.find` or `layout.find`.
- Recent-result context caps are marked separately from native search truncation. No file or note contents are added.
- Confirmed repository guards: frontend serialized context is limited to 64,000 characters; native assistant protocol limits context to 64,000 UTF-8 bytes.

## Files
- `still-desktop/src/domain/workbenchContext.ts`
- `still-desktop/src/useStillWorkbench.tsx`
- `still-desktop/tests/workbench-context.test.mjs`

## Checks
- `pnpm exec tsc --noEmit` — passed.
- `pnpm exec tsx --test tests/workbench-context.test.mjs tests/workbench-operations.test.mjs` — 15 passed.
- `git diff --check` — passed.

## Handoff
- Small directories keep their prior workbench snapshot shape. Partial directories identify omitted counts; structured search operations are unchanged.
