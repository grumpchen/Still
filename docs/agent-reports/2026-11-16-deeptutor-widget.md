# Task: DeepTutor widget handoff

- Agent: Codex GPT-6
- Time: 2026-11-16T12:32:44+08:00

## Done
- Added a DeepTutor widget with a saved instance URL, URL validation, and actions to open the configured instance.
- Added a Files handoff for selected plain-text and PDF files. Text is extracted locally, staged in the DeepTutor widget, and copied only after the user selects “Copy context and open.”
- Added English and Chinese UI strings and bounded handoff prompt tests.

## Files
- `still-desktop/src/DeepTutorWidget.tsx`
- `still-desktop/src/domain/deepTutor.ts`
- `still-desktop/src/domain/widgetCatalog.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/FilesWidget.tsx`
- `still-desktop/src/localization.tsx`
- `still-desktop/src/styles.css`
- `still-desktop/src/widgets.tsx`
- `still-desktop/tests/deep-tutor.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite reported the existing large-chunk advisory.
- Focused DeepTutor tests — 3 passed.
- `pnpm test` — 455 passed, 37 failed. The pre-change baseline at `c028c79` had 448 passed and the same 37 failures; none were added by this task.

## Handoff
- DeepTutor must be running separately. Still stages the prompt, copies it to the clipboard on explicit user action, and opens DeepTutor; the user pastes and submits there. This avoids assuming an unsupported external prompt-submission API.
- Remote instances require HTTPS. Plain HTTP is accepted only for loopback addresses.
- A live end-to-end session against a running DeepTutor server was not available in this workspace.
