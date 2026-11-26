# Task: Run native geometry fixtures separately

- Agent: Codex (coordinator)
- Time: 2026-11-26T14:31:00+00:00

## Done
- Retained the fast Rust domain/regression pass, and added separate, serial Windows steps for the two real-window geometry fixtures it filters.
- Each fixture has a two-minute limit and reports its actual result without `continue-on-error`. Candidate build/upload still run after a failed check.

## Files
- `.github/workflows/windows-build.yml`

## Checks
- `git diff --check`: passed.
- Windows execution: pending next candidate workflow; Linux cannot execute these Win32 tests.

## Handoff
- Earlier reports of 141 Rust tests passing with two filtered fixtures do not establish native geometry behavior. The original reason for filtering was not preserved in the available report; no prior fixture failure is inferred.
