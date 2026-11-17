# Task: AI Command widget

- Agent: Codex
- Time: 2026-11-17T06:33:57+00:00 (Asia/Shanghai)

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
- Focused AI Command tests — 2 passed.
- `pnpm test` — 440 passed, 37 failed out of 477. The failures are in existing settings, layout, Apps, notes, sidebar, and widget plugin tests; none are AI Command tests.
- `git diff --check` — passed.

## Handoff
- Daily time and after-course scheduling are not included in this button-first implementation. The command widget is available in the widget gallery and can be added to any workspace.
- AI use requires a configured provider. The app's normal action confirmation remains in effect.
