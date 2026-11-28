# Task: In-chat assistant error explanations

- Agent: Codex, GPT-6.2 Sol
- Time: 2026-11-28T19:43:00+08:00

## Done

- Display failed sends as a Still AI message inside the conversation and leave the draft available.
- Keep failure messages out of provider history. Generate the explanation from the captured failure without a second provider call.
- Distinguish empty, incomplete, invalid JSON, and unexpected structured replies. Report known provider finish reasons and distinguish DeepSeek billing and rate limits.

## Files

- `still-desktop/src/AssistantPanel.tsx`
- `still-desktop/src-tauri/src/assistant.rs`
- `still-desktop/src-tauri/src/assistant_protocol.rs`

## Checks

- `pnpm check` passed.
- `pnpm exec tsx --test tests/assistant-panel.test.mjs tests/assistant-chat.test.mjs` passed all 17 tests.
- `git diff --check` passed.
- Native checks require Windows CI. This workspace has no Cargo executable.

## Handoff

- Continued the parser fixes on `agent/codex/modes-flashcards`, the branch used for the current Workbench preview. The changes require a new Windows build to reach users.
