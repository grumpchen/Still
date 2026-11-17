# Task: AI-generated widget first version

- Agent: Codex
- Time: 2026-11-17T20:28:39+00:00 (UTC)

## Done
- Added a fixed AI Component widget. It asks the selected API provider for a strict declarative definition, validates the response, and lets the user edit and run its instruction.
- Added TXT/Markdown input with a 1 MB file limit and 12,000-character request cap. Text is sent only when the user runs the component; file text and results are ephemeral.
- Preserved definitions through workspace reload, duplication, Group shortcut/collection, and tray preset paths. Invalid definitions keep the card available for regeneration.
- Updated the Luna plan with implemented scope and remaining milestones.

## Files
- `still-desktop/src/GeneratedWidget.tsx`
- `still-desktop/src/domain/generatedWidget.ts`
- `still-desktop/src/domain/workspaces.ts`
- `still-desktop/src/domain/presets.ts`
- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src/platform/assistant.ts`
- `still-desktop/docs/plans/2026-11-17-generated-widgets.md`
- `still-desktop/tests/generated-widget.test.mjs`

## Checks
- `pnpm check` — passed.
- `pnpm build` — passed; Vite emitted the existing large-chunk warning.
- Focused generated-widget tests — 6 passed.
- Full `pnpm test` — 446 passed, 37 failed out of 483. Running the same suite at base `e78babf` produced 440 passed and the same 37 failures.
- `git diff --check` — passed.
- No live provider request or Windows desktop smoke test was run.

## Handoff
- Add PDF text extraction and an explicit Notes target/save confirmation. Add ChatGPT plan support and test native Explorer drag behavior. The selected file body is not persisted; provider execution uses one request and is limited to the API providers supported by `assistant_chat`.
