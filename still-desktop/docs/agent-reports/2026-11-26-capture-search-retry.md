# Task: capture retry and Library search

- Agent: Luna (model not recorded)
- Time: 2026-11-26T14:07:14+00:00

## Done
- QuickCapture rotates to a fresh operation key after a known pre-mutation failure (`failed`, `changed:false`), allowing corrected input to execute.
- After a resource is saved, QuickCapture keeps the exact resource and attempt ID pending until capture inbox recording succeeds. Inputs stay locked while pending; closing and reopening retains the pending event so retry does not repeat the save or choose another PDF.
- PDF capture uses the source ID returned by the host after saving, rather than the possibly stale picker entry source ID.
- Library search skips native folder search when there are no searchable folders but still searches saved links and PDF shortcut metadata. Empty folder search only says “no matches” when no link or PDF shortcut matches either.
- File operation notifications remain after successful dispatcher results only.

## Files
- `src/QuickCapture.tsx`
- `src/LibraryHome.tsx`
- `tests/quick-capture-retry.test.mjs`
- `tests/library-search-without-folders.test.mjs`

## Checks
- `pnpm check`: passed.
- `node_modules/.bin/tsx --test tests/quick-capture-retry.test.mjs tests/library-search-without-folders.test.mjs`: passed, 3/3.
- `git diff --check`: passed.

## Handoff
- Existing App wiring already returns `{widgetId,name,sourceId}` from `saveCapturedPdf` and awaits `automationCaptureInbox.recordSavedCapture` through `onCaptureSaved`; no App changes were needed.
- A pending queue failure leaves the resource saved and retryable in the mounted QuickCapture component. The user may close and reopen it; the exact pending event remains in component memory until the queue accepts it or Still is restarted.
