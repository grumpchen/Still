# Task: library-workspace-inbox-foundation

- Agent: Codex GPT-6
- Time: 2026-10-27T21:41:00+13:00

## Done
- Added a built-in Library workspace with Files and Notes; older saved states gain it once while keeping Dashboard and existing workspace data.
- Added the desktop Still Downloads inbox under Documents/Still/Downloads, using an opaque native folder grant and the existing bounded file preview/listing.
- The Library shows the exact inbox path so the user can explicitly set their browser's download folder. Still does not change browser/system preferences or delete files.
- Protected Dashboard and Library from accidental workspace deletion.

## Files
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/platform/files.ts`
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src/App.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/tests/canvas.test.mjs`
- `still-desktop/tests/workspaces-relaunch-migration.test.mjs`
- `docs/plans/2026-10-27-study-platform-upgrade.md`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the large-chunk advisory (608.64 kB JS).
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed with one existing unused-method warning in `dropped_files.rs`.
- `git diff --check` — passed.
- Tests not run per task instructions.

## Handoff
- This delivers the Library/inbox foundation, not all of Phase 2. Next add resource search/filtering across the library, safe AI classification suggestions, and actions to send selected files into Notes/AI. Do not automatically discard or delete downloads.
