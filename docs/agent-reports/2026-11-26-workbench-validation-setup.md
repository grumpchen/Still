# Task: Workbench validation setup

- Agent: Codex, GPT-6
- Time: 2026-11-26T12:43:00+00:00

## Done
- Verified terminal GitHub read access and cloned latest main `4121e8a` into a clean workspace.
- Assigned implementation to Luna in an isolated worktree and branch.
- Updated Windows CI to run on candidate branches, execute complete frontend and Rust regression checks, and retain a commit-addressed Windows executable even when a regression check fails. Failures continue to fail the job.
- Recorded pre-change test failures in `docs/validation/main-baseline.json`.

## Files
- `.github/workflows/windows-build.yml`
- `docs/validation/main-baseline.json`

## Checks
- `git ls-remote https://github.com/grumpchen/Still.git refs/heads/main`: passed.
- `pnpm install --frozen-lockfile`: passed.
- `pnpm check`: passed.
- `pnpm test`: 502 tests; 464 passed, 38 failed on unchanged main.

## Handoff
- Linux cloud browser available; no interactive remote Windows environment identified. Windows native GUI acceptance remains separate from hosted Actions automation.
- Do not count baseline failures as passing checks. Compare candidate failures with recorded names.
- Additional unchanged-main browser baseline: `dashboard-edit-layout`, `dashboard-layouts`, `workspace-smoke` passed (3/3) in Linux Chromium; no native desktop claims.
- Added Rust dependency caching for repeated candidate Windows builds.
- Baseline Windows Actions run `45822271751`: TypeScript passed; frontend 464/502 passed (same 38 failures as Linux); Rust 130 passed with 2 desktop-geometry fixtures filtered; release executable built and uploaded successfully. Overall run correctly remains failed due to frontend checks.
- Candidate executable artifacts now include a SHA-256 sidecar for matching any later remote Windows acceptance to the exact tested binary.
