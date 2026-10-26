# Task: canvas smoothness pass

- Agent: Codex GPT-6
- Time: 2026-10-26T23:09:48+13:00 Pacific/Auckland

## Done
- Removed a per-widget full scan of the workspace from the canvas render path. Widget type totals are now computed once per render, reducing this work from quadratic to linear as workspace size grows, including during drag updates.
- Kept duplicate widget numbering unchanged and added a rendered regression check for it.
- Reviewed drag scheduling: pointer bursts are coalesced, movement follows the selected refresh cap, and pointer-up flushes the final position.

## Files
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/tests/workspace-layout.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite still reports the existing large JavaScript chunk warning.
- New duplicate-label regression test — passed.
- Notes persistence — 8/8 passed; Notes library rendered test — 1/1 passed.
- Full `pnpm test` — 260/308 passed; 48 failed. Output includes tests expecting removed Browser widget behavior or the older schema version, and DOM-render tests with delayed native-event/teardown errors. This pass did not audit each unrelated failure to closure.
- Full canvas layout test file — 5/7 passed; two existing harness failures involve a delayed Tauri event after teardown and a resulting `window` reference after test cleanup.
- `git diff --check` — passed.

## Handoff
- No Windows drag benchmark or visual profiling was performed; the improvement targets a clear repeated-work hotspot in the drag render path.
- Live Development window remained open. Full-suite and harness failures remain for a separate test-maintenance pass.
