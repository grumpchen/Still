# Task: AI Command widget

- Agent: Codex
- Time: 2026-11-17T14:33:57+08:00 (Asia/Shanghai)

## Done
- Added an AI Command widget that lets users name and save an instruction, then run it with one button press.
- Runs submit through Still AI's existing provider/model, workspace context, and confirmation flow. No shell execution or automatic file operations were added.
- Bounded saved prompts to 8,000 characters and added English and Simplified Chinese labels.

## Files
- `still-desktop/src/domain/widgetCatalog.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/widgets.tsx`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/tests/ai-command-widget.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted its existing large-chunk warning.
- v0.2367 focused release suite — 78 passed, including AI Command, Files, assistant, canvas, and workspace tests.
- Windows GitHub Actions run — TypeScript passed; focused tests passed; Rust tests passed with the two documented real-window fixture skips; Windows executable built and uploaded.
- Downloaded `ver0.2367.exe` and verified SHA-256 `3759d62e18255c05c93abf27825bd20b8b06c33f0d2e5c6ad65056ce10b4d570`.
- Earlier full suite on the implementation branch — 440 passed, 37 failed out of 477 in existing settings, layout, Apps, notes, sidebar, and widget plugin tests; no AI Command tests failed.
- `git diff --check` — passed.

## Handoff
- Daily time and after-course scheduling are not included in this button-first implementation. The command widget is available in the widget gallery and can be added to any workspace.
- Published prerelease: https://github.com/grumpchen/Still/releases/tag/v0.2367.
- AI use requires a configured provider. The app's normal action confirmation remains in effect.
