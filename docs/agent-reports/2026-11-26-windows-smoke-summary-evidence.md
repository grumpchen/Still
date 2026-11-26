# Windows smoke log evidence summary

The Windows smoke CI log previously printed only the overall pass/fail result, leaving the JSON artifact as the only source for the actual hidden-window rule receipt and workspace mutations. The summary now prints:

- Candidate executable SHA-256.
- Each check name and pass/fail status, with per-check detail allowlists.
- For the tray rule: rule ID, trigger/action, pre-hide target widget IDs, saved layout types, hidden timestamp/status, succeeded receipt metadata and start time, post-apply widget IDs/types, and the later-tick dedupe result.
- For failed checks: bounded, redacted error text, CDP probe cause, and a bounded process summary.

The log summary never emits a full process command line, executable path, or captured stdout/stderr. The full structured JSON report remains an artifact for deeper inspection.

Validation: `node --check still-desktop/scripts/windows-workbench-smoke.mjs` and `git diff --check` passed. This change has not been run on a Windows runner.
