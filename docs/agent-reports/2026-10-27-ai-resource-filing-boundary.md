# Task: add the scoped resource filing boundary

- Agent: Codex GPT-6
- Time: 2026-10-27T23:33:53+13:00 (Pacific/Auckland)

## Done
- Added a native file move primitive scoped to the selected Files widget's existing folder grant.
- Added path and Windows folder-name checks, rejected links and blocked programs, created nested destination folders only after invocation, and preserved existing destination files.
- Added a TypeScript bridge for the native command and documented the reviewed filing architecture.

## Files
- `still-desktop/src-tauri/src/files.rs`
- `still-desktop/src-tauri/src/main.rs`
- `still-desktop/src/platform/files.ts`
- `docs/plans/2026-10-27-ai-reviewed-resource-filing-design.md`

## Checks
- `pnpm build` — passed; Vite reported the existing large JavaScript chunk advisory.
- Focused Rust filing test — passed, including nested filing, path/name rejection, blocked-file rejection, and collision preservation.
- `git diff --check` — passed.

## Handoff
- The move command is not yet exposed in the interface. Next stages add a structured AI folder proposal, an explicit review card, note-path migration, and a Files widget refresh.
