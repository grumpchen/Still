# Task: browser Library search root cap

- Agent: Luna (model not recorded)
- Time: 2026-11-26T14:59:21+00:00

## Done
- Separated omitted-root overflow from actual scan-limit truncation so a 401-root browser search still scans all 400 permitted roots before returning `truncated:true`.

## Files
- `src/platform/files.ts`
- `tests/library-search-batches.test.mjs`

## Checks
- `pnpm check`: passed.
- `node_modules/.bin/tsx --test tests/library-search-batches.test.mjs`: passed, 5/5, including a match on the 399th root with 401 requested.
- `git diff --check`: passed.

## Handoff
- Parent owns integration and final CI. No other source changed.
