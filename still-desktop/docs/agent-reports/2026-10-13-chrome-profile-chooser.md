# Task: Chrome profile chooser handoff

- Agent: Codex GPT-6
- Time: 2026-10-13T13:15:41+13:00

## Done
- Generic Chrome launches now explicitly open Chrome's profile picker, even when Chrome already has a background process.
- Still keeps the picker visible and waits for the chosen foreground Chrome profile window before attaching. Explicit profile shortcuts continue to open their requested profile directly.
- Added regression coverage that rejects the picker itself, unrelated windows, and already-managed windows as the selected profile.

## Files
- `src-tauri/src/app_panel.rs`

## Checks
- Regression test first failed on the old generic launch arguments, then passed after the fix.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml -- --test-threads=1`: 75 passed.
- `pnpm check`: passed.
- `git diff --check`: passed.
- Manual Windows chooser handoff was not exercised; the current live Still workspace has no Chrome Apps card open.

## Handoff
- Restart Still's native development process to load this Rust change, then launch a generic Chrome Apps shortcut and choose Grump. Profile-specific shortcuts continue to bypass the chooser by design.
