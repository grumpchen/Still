# Task: Safe Still AI workspace controls

- Agent: Codex (GPT-6)
- Time: 2026-10-13T15:16:27+13:00

## Done
- Extended Still AI with validated add-widget and open-saved actions for built-in widgets, saved presets, and Groups. Tray context shares only names, types, and opaque IDs.
- Reopening saved app shortcuts asks for confirmation. Existing destructive confirmation and Undo flows remain in place.
- Enforced a maximum of 10 items created/opened per assistant request and 100 widget cards per workspace. Explicit oversized requests are blocked before a provider call; parsers and state application enforce the caps again.
- Updated the assistant usage/safety notes and saved implementation plan.

## Files
- `src/domain/assistant.ts`
- `src/AssistantPanel.tsx`
- `src/App.tsx`
- `src-tauri/src/assistant_protocol.rs`
- `tests/assistant.test.mjs`
- `tests/assistant-sidebar.test.mjs`
- `docs/plans/2026-10-11-gemini-sidebar.md`
- `docs/plans/2026-10-13-safe-assistant-workspace-controls.md`
- `docs/agent-reports/2026-10-13-safe-assistant-workspace-controls.md`

## Checks
- `node --test tests/assistant.test.mjs tests/assistant-sidebar.test.mjs` — passed (22 tests).
- `pnpm.cmd check` — passed.
- `pnpm.cmd build` — passed.
- `cargo test --manifest-path src-tauri\Cargo.toml assistant_protocol -- --test-threads=1` — passed (7 Rust tests).
- `pnpm.cmd test` — 235 passed, 28 failed. Failures are in other work already present in the shared tree, including tests referencing the removed `BrowserWidget.tsx` and legacy state/schema expectations.

## Handoff
- Assistant actions remain limited to Still's typed workspace features; no shell, filesystem, or arbitrary Windows control is exposed. The batch and workspace ceilings prevent runaway widget creation, while input and response validation keep oversized actions from partially applying.
- Real provider calls and live Windows acceptance were not performed. The full suite still needs cleanup in its unrelated failing areas before it can serve as a clean regression signal.
