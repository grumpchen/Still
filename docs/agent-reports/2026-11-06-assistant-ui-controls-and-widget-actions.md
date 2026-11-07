# Task: assistant UI controls and widget actions

- Agent: Codex
- Time: 2026-11-06T08:09:56+13:00 (Pacific/Auckland)

## Done
- Added the reversible `set_ui_visibility` action for the Still sidebar and bottom Apps bar. The native protocol and prompt schema validate a single supported target, and the action does not control the Windows taskbar or native app windows.
- Made direct minimize/restore requests resolve a named or @-selected widget locally. Unclear multi-widget targets remain on the clarification path; action intent validation checks deterministic targets.
- Rebuilt and copied the Windows desktop executable. The copied file matches the build output by SHA-256.

## Files
- `still-desktop/src/domain/assistant.ts`
- `still-desktop/src/App.tsx`
- `still-desktop/src-tauri/src/assistant_protocol.rs`
- `still-desktop/tests/assistant.test.mjs`
- `docs/agent-reports/2026-11-06-assistant-ui-controls-and-widget-actions.md`

## Checks
- `pnpm exec tsx --test tests/assistant.test.mjs` — 47 passed.
- `pnpm exec tsc --noEmit` — passed.
- `cargo test --offline assistant_protocol::tests` — 13 passed; existing unused `set_chrome_profile` warning remains.
- `pnpm run build` — passed; existing large JavaScript chunk warning remains.
- `pnpm exec tauri build --target x86_64-pc-windows-msvc --no-bundle` — passed; executable was not launched.
- `pnpm exec playwright test tests/e2e/dashboard-assistant.spec.ts --grep "maximized and narrow assistant keeps" --timeout 60000` — 1 passed (14.7s).
- `git diff --check` — passed; Git reported existing LF-to-CRLF notices.
- EXE copied to `D:\Still\builds\still-latest-2026-11-06-assistant-controls\release\still-desktop.exe`, 20,152,832 bytes, SHA-256 `6C7287DE1ECEEAA1644F3F74E8F8A33DFA54B7E5BBF8C9529269D9B6B7B193C2`.

## Handoff
- No commit or push was made because this checkout contains unrelated and overlapping uncommitted work. The assistant capability-parity audit remains open; native Windows interaction was not manually tested.
