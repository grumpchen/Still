# Task: bounded Library root search batches

- Agent: Luna (model not recorded)
- Time: 2026-11-26T14:57:07+00:00

## Done
- The native Files adapter now deduplicates roots and searches them sequentially in batches of at most 40, preserving the native command's existing security limit.
- Merged results are capped at 500 and unavailable roots are deduplicated. The response reports `truncated:true` when a native batch is partial, combined hits reach the cap before remaining batches, or the 400-root total bound omits roots. Search stops immediately after a partial batch or result cap.
- Browser search keeps its bounded scan and now deduplicates roots and applies the same 400-root total ceiling.

## Files
- `src/platform/files.ts`
- `tests/library-search-batches.test.mjs`

## Checks
- `pnpm check`: passed.
- `node_modules/.bin/tsx --test tests/library-search-batches.test.mjs`: passed, 4/4 using mocked Tauri invoke.
- `git diff --check`: passed.

## Handoff
- Native Rust command and its 40-root validation are unchanged. The parent owns integrating and pushing this candidate.
