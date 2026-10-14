# Task: Chrome stability

- Agent: Codex (GPT-6.1)
- Time: 2026-10-14T20:08:04+13:00

## Done
- Kept Chrome profile-picker selections in the managed Still Apps panel instead of routing them to the desktop.
- Persisted validated Chrome profile arguments from the selected window’s relaunch metadata so a saved shortcut can reopen that profile directly; legacy path-only shortcut records still load.
- Restored native Apps panel presentation after drag completion, including quick-save and workspace transfer paths.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`, `app_picker.rs`, `dropped_files.rs`, `Cargo.toml`
- `still-desktop/src/AppsWidget.tsx`, `WorkspaceCanvas.tsx`, `platform/appPanel.ts`
- `still-desktop/tests/quick-save-drop.test.mjs`

## Checks
- `pnpm build` — passed; Vite reported the existing large JavaScript chunk warning.
- Focused Chrome-profile Rust tests — 4 passed; managed picker attachment test — 1 passed.
- `pnpm exec node --test tests/quick-save-drop.test.mjs` — 2 passed.
- Full Rust suite — 83 passed, 1 failed in the unrelated `assistant_protocol::tests::named_notes_creation_and_errors_are_validated_without_losing_actions` assertion.
- Full frontend suite — 263 passed, 36 failed; failures include stale Browser-widget expectations and other unrelated suite drift.
- Isolated native QA Still window launched. Windows’ native file picker did not accept automated input, so end-to-end selection of a Chrome profile and real profile-argument capture remain unverified.

## Handoff
- Code-level Chrome routing, profile persistence/migration, and saved-tray drag regressions are covered and pass.
- Manually verify choosing a Chrome profile in the isolated build, saving the Apps card, and reopening it from Saved +. The full-repository failures remain outside this Chrome change and should be triaged separately.
