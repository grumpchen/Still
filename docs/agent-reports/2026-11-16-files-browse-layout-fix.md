# Task: Files browse layout fix and release

- Agent: Codex GPT-6
- Time: 2026-11-16T18:22:29+08:00

## Done
- Kept the Files search field and rows in one vertical panel, preventing the browse-mode row layout from stretching the search input across the widget and squeezing the list away.
- Added a regression check for the panel structure and browse sizing.
- Prepared patch version 0.236.6 / release tag v0.2366 and updated the Windows release workflow to run the Files regression tests and include the fix in release notes.

## Files
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/files-browse-layout.test.mjs`
- `.github/workflows/windows-release.yml`
- `still-desktop/package.json`
- `still-desktop/src-tauri/Cargo.toml`
- `still-desktop/src-tauri/Cargo.lock`
- `still-desktop/src-tauri/tauri.conf.json`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted its existing large-chunk advisory.
- Focused Files tests — 6 passed.
- Full suite — 456 passed, 37 failed. The same 37 failures were present in the pre-feature baseline at `c028c79`.
- Windows GitHub Actions release workflow — completed successfully; TypeScript, focused Files tests, and Rust tests passed.
- Published `v0.2366` with `ver0.2366.exe` (SHA-256 `1071318ca6fd13e83d014db8f0f3373567eae9386317ddbb7fa8efa8e30bd7c8`).

## Handoff
- No live Windows GUI test was performed; CI produced and uploaded the Windows release executable.
