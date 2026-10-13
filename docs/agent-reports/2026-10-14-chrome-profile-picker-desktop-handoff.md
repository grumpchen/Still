# Task: Chrome profile picker desktop handoff

- Agent: Codex
- Time: 2026-10-14T11:35:12+13:00

## Done
- Changed the Chrome profile-picker flow to show the selected Chrome window as a normal Windows desktop window instead of attaching it to the Apps panel.
- Recovery now considers hidden Chrome windows only during profile selection and accepts a foreground selected-profile window even when Chrome keeps the chooser window alive. Ambiguous background candidates are ignored.
- The Apps card clears its saved open-panel intent and reports that Chrome opened outside Still, preventing a stale widget state from relaunching the picker.

## Files
- `still-desktop/src-tauri/src/app_panel.rs`
- `still-desktop/src/AppsWidget.tsx`
- `still-desktop/src/platform/appPanel.ts`
- `still-desktop/tests/apps-widget-present.test.mjs`

## Checks
- `cargo test --manifest-path src-tauri/Cargo.toml profile_picker -- --nocapture` — 3 passed.
- `node --test --test-concurrency=1 tests/apps-widget-present.test.mjs` — 5 passed.
- `pnpm run check` — passed.
- `pnpm run build` — passed.
- Full Rust suite — 82 passed; one unrelated existing assistant-protocol assertion failed (`named_notes_creation_and_errors_are_validated_without_losing_actions`).
- Full frontend suite was interrupted after overlapping test runs caused Vite port conflicts; focused Apps tests passed.
- Live Windows Chrome picker acceptance remains outstanding; no browser or desktop app was launched.

## Handoff
- Rebuild/restart Still, then select Grumpchen in the Chrome profile picker. Verify its Chrome window appears on the desktop and the Apps card reports that it is outside Still.
