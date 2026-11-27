# Automation Rules UI feedback

- Added practical supported sentence examples and a note that names are resolved exactly. Unsupported sentences and rule creation errors render as alerts; saved, duplicate, and Run due now outcomes render as explicit status messages.
- Run due now now reports a structured summary from the runner: number due, succeeded, needing attention, and not confirmed. It distinguishes an empty due check from a successful operation and reports when no capture queue is connected. The existing due calculation, persistent receipts, native tray scheduler, and web-preview-only timer behavior remain the source of execution semantics.
- Added a browser UI test that starts with an empty list, verifies the empty-due response, submits an unsupported sentence and sees the alert, saves a supported past-due layout rule, invokes Run due now, and verifies both the succeeded receipt and cloned workspace widgets.

## Verification
- Automation rule/runner/hook tests: 21 passed.
- `pnpm check`: passed.
- Browser E2E with `STILL_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium`: passed for the new Rules UI scenario. The default configured Edge executable was unavailable in this environment.
- `git diff --check`: passed.
