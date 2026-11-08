# Task: Fix PDF keyword schema and number contrast

- Agent: Codex
- Time: 2026-11-09T10:52:24+13:00

## Done
- Clarified that PDF keyword results belong inside the `reply` field of Still's standard provider response, with no workspace actions. Added lecture-focused selection guidance and kept PDF text marked as untrusted.
- Increased the contrast of detected PDF numbers with an amber underline and distinct blue selected state.
- Kept keyword matches reviewed before applying; the PDF itself remains unchanged.

## Files
- `still-desktop/src/localization.tsx`
- `still-desktop/src/canvas.css`
- `still-desktop/tests/assistant-agent-notes-panel.test.mjs`
- `still-desktop/tests/e2e/pdf-highlights.spec.ts`
- `still-desktop/tests/native/assistant-reliability.mjs`

## Checks
- `pnpm.cmd check` — passed.
- `pnpm.cmd exec tsx --test tests/assistant-agent-notes-panel.test.mjs` — 16 passed.
- `pnpm.cmd exec playwright test --config playwright.pdf.config.ts tests/e2e/pdf-highlights.spec.ts --reporter=line` — 1 passed.
- `node --import tsx tests/native/assistant-reliability.mjs pdf-highlights` with isolated target `D:\Still\native-fixture-target` — passed in the Windows Tauri/WebView2 fixture. Verified the ChatGPT-provider request contract, selected-PDF-text scope, local apply/clear, unchanged source hash, number selection, and arithmetic wheel.
- No live Codex subscription response was sent during verification; the native provider was a deterministic fixture.

## Handoff
- Follow-up TODO from the user: improve viewing for unsupported document formats such as DOCX in the Downloads Files widget. Verify the existing default-app action and add a clear viewer choice (Still where supported, Windows default app, or another selected app). Check `~$*.docx` carefully because Office uses those names for temporary lock files.
- Continue with the broader Files-first workspace and agent reliability objective; do not treat this increment as completion.
