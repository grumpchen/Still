# Task: Organize current and older files

- Agent: OpenCode assistant (GPT-6 Luna)
- Time: 2026-10-05T21:50:21.638+13:00 (local time)

## Done
- Kept `ver0.18.exe` and its app-picker preview in the project root; verified the executable metadata reports version 0.18.0.
- Moved 21 older release/feature builds and matching release previews into `archive/older-versions/`.
- Moved 8 historical screenshots into `archive/previews/` and 39 unused preview bundles into `archive/previews/assets/`. Kept the two JS/CSS bundles referenced by the current `design-preview.html` in `assets/`.
- Extracted all 135 source-archive files into `still-desktop/` and preserved the original ZIP in `archive/source-archives/`.
- Updated documentation links and added a root `.gitignore` for local executable and ZIP artifacts.

## Files
- `archive/` (older builds, historical previews, source archive, archive guide)
- `still-desktop/` (extracted application source and updated documentation links)
- `assets/` (current preview bundles retained)
- `.gitignore`, `AGENTS.md`, `README.md`, `architecture.md`, `implementation-plan.md`
- This report

## Checks
- Confirmed current release, preview, source files, archive files, and both preview bundles exist.
- Confirmed all checked documentation references resolve after relocation.
- Confirmed `design-preview.html` references only the two retained assets.
- Confirmed the executable version metadata is 0.18.0 and `.exe`/`.zip` artifacts are ignored by Git.
- Could not run project tests/build: Node.js, pnpm, Cargo, and Rust are not installed/available in this environment. No executable was run.

## Handoff
- The newest release remains at the root as `ver0.18.exe`; historical builds are under `archive/older-versions/`.
- The app source is available in `still-desktop/`; install the documented toolchain/dependencies before running its test/build scripts.
- Executables and ZIP archives remain local and are excluded from Git history by `.gitignore`.
