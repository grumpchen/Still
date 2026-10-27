# Task: General app matching and Notes reflection

- Agent: Codex
- Time: 2026-10-27T15:41:20+13:00 (Pacific/Auckland)

## Done
- Expanded app-window matching to use exact executable identity first, then visible-window process ancestry and the shortcut's Windows AppUserModelID. Ambiguous matches continue to ask the user to choose.
- Restored pointer-following reflection on the Notes metal header through direct CSS variable updates, without changing the fixed header height or adding reflection to the Notes body.
- Restarted the Still native desktop preview with the current source.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src-tauri/Cargo.toml`
- `still-desktop/src/WorkspaceCanvas.tsx`
- `still-desktop/src/canvas.css`

## Checks
- `pnpm build` — passed; existing large-chunk advisory remains.
- `cargo check --manifest-path src-tauri/Cargo.toml` — passed using the installed Cargo executable.
- `git diff --check` — passed.
- Native Still development preview restarted and process confirmed running. App attachment to Doubao, Douyin, and Steam was not manually exercised in this run.

## Handoff
- Changes are committed locally on `agent/codex/notes-library`; not pushed.
- Exact path remains the strongest match. Process ancestry and AppUserModelID extend matching for helper-process and packaged apps; ambiguous candidate windows still fail safely instead of attaching an arbitrary window.
