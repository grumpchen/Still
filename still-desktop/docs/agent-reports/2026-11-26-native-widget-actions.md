# Native widget actions

## Changes

- Moving a live Apps widget now suspends and verifies its native panel before changing workspace state. It keeps the same widget ID and uses the existing retained collection/resume path; a failed move cancels collection so the source widget remains available.
- Explicit Still AI widget removal and workspace deletion request normal close for live native Apps windows before removing persisted state. The close request ignores the manual close preference, while manual widget removal keeps its existing preference.
- Native release reports whether a managed window was released and whether Windows accepted a normal close request. Failed or incomplete native requests and storage writes keep widget data and report the actual close/release outcome. Undo after a close request restores card data without reopening the process.
- Added an asynchronous revalidation step before source/destination transfer and destructive mutations so stale state is not written after awaiting native operations.

## Verification

- `node --import tsx --test tests/native-widget-lifecycle.test.mjs`: 6 passed.
- Related assistant, bulk removal, native group drag, and workspace controls tests: 65 passed.
- `pnpm check`: passed.
- Windows runtime verification was not available in this Linux environment.
