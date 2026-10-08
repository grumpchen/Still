# Group widget collection

Task branch: `agent/codex/group-improvements`

Baseline: `d7be5fa9f54e6d801b7b9265cde8f00a91074fed`

Implementation starts after the separate Group header naming commit `7988c9a`.

## Behavior

- Dragging a supported open widget onto a Group moves the full widget instance into that Group. Dropping on empty tray space creates a new Group; dropping on an existing Group appends it. The source remains recoverable from the Group.
- Selecting a collected entry restores its original widget ID, content, settings, and saved placement (clamped to the available workspace). Reusable shortcut entries retain their existing create-new behavior.
- Groups reject nested Groups and duplicate collected instances. Removing a Group with collected widgets is blocked so the saved state cannot be discarded accidentally.
- App and Chrome native panels are hidden and retained in process memory during collection, then resumed under the same widget ID. Window handles and process IDs are never persisted. A native window that is gone after a Still restart must be reattached; its safe widget configuration remains saved.
- Saved widget entries show the widget-type icon, using a validated app icon when present.

## Checks

- `node --test tests/group-tray.test.mjs`: 16 passed.
- `corepack pnpm check`: passed.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed.
- `git diff --check`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`: 46 passed, 1 ignored, 2 failed in the existing App panel minimum-size tests `c1_a_maximized_first_sample_never_becomes_the_floor` and `c2_a_persistently_clamping_app_keeps_its_floor_until_a_real_probe_is_accepted`. Those code paths were not changed by this feature.

Windows native behavior still needs live acceptance with the generated test build, especially moving/collecting and restoring an attached Apps or Browser window.
