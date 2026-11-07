# Task: Library Downloads navigation

- Agent: Codex
- Time: 2026-11-06T13:20:21+13:00

## Done
- Moved the Still Downloads entry into Library contents and removed the Files toolbar button.
- Reuse the existing inbox source and create its internal backing source only if it is missing; ordinary folders stay separate.

## Files
- `still-desktop/src/LibraryHome.tsx`, `src/App.tsx`, `src/FilesWidget.tsx`
- `still-desktop/tests/e2e/library-downloads-nav.spec.ts`

## Checks
- `pnpm build` passed; Vite reported the existing large-chunk warning.
- `pnpm exec playwright test tests/e2e/library-downloads-nav.spec.ts --workers=1` passed.
- Initial concurrent Playwright run timed out during page loading; an intermediate navigation test used an incorrect label and was corrected.

## Handoff
- Desktop access to the real Downloads folder was not tested in this task. Changes remain uncommitted alongside pre-existing work.
